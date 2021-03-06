import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import Fuse from 'fuse.js';
import { City } from '../interfaces/city';
import { from, fromEvent, Observable, of, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { CityQuery } from '../interfaces/city-query';
import { CitiesRepository } from './cities.repository';
import { CityQueryResult } from '../interfaces/city-query-result';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CitiesRepositoryEvents, CitiesSeederEvents } from '../../app-events';
import { CITIES_IN_MEMORY_CONFIG, CitiesInMemoryConfiguration } from './config';

@Injectable()
export class CitiesInMemoryRepository
  implements CitiesRepository, OnApplicationBootstrap {
  private cacheState = new CacheState();
  private fuse: Fuse<City>;
  private readonly logger = new Logger(CitiesInMemoryRepository.name);

  constructor(
    @Inject(CITIES_IN_MEMORY_CONFIG)
    private readonly config: CitiesInMemoryConfiguration,
    private readonly events: EventEmitter2,
  ) {
    this.listenEvents();
  }

  private listenEvents() {
    this.cacheState.doIndex$.subscribe(() => this.index());

    fromEvent<City>(
      this.events,
      CitiesSeederEvents.NEW_CITY,
    ).subscribe((city) => this.cacheState.onNewCity(city));

    fromEvent(this.events, CitiesSeederEvents.SEEDING_FINISHED).subscribe(() =>
      this.cacheState.setLoaded(),
    );
  }

  private index() {
    const index = Fuse.createIndex(this.config.indexes, this.cacheState.cities);
    this.fuse = new Fuse<City>(
      this.cacheState.cities,
      {
        includeScore: true,
        keys: this.config.indexes,
        distance: this.config.textDistance,
        threshold: this.config.scoreThreshold,
      },
      index,
    );
    this.events.emit(CitiesRepositoryEvents.CITIES_READY);
  }

  query({ query }: CityQuery): Observable<CityQueryResult> {
    if (!this.cacheState.ready) {
      this.logger.warn(`Attempted to query cities before cache was ready`);
      return from([]);
    }
    return from(this.fuse.search(query)).pipe(
      map(({ item, score }) => ({
        ...item,
        searchScore: 1 - (score || 0),
      })),
    );
  }

  getMaxPopulation(): Observable<number> {
    return of(this.cacheState.maxPopulation);
  }

  onApplicationBootstrap(): any {
    this.events.emit(CitiesRepositoryEvents.SEEDING_REQUESTED);
  }
}

class CacheState {
  private _maxPopulation = 0;
  private _cities: City[] = [];
  private _citiesLoaded = false;
  private _doIndex$ = new Subject<void>();

  onNewCity(city: City) {
    this.cities.push(city);
    this._maxPopulation = Math.max(city.population, this._maxPopulation);
  }

  setLoaded() {
    this._citiesLoaded = true;
    this._doIndex$.next();
  }

  get maxPopulation() {
    return this._maxPopulation;
  }

  get cities() {
    return this._cities;
  }

  get ready() {
    return this._citiesLoaded;
  }

  get doIndex$(): Observable<void> {
    return this._doIndex$;
  }
}
