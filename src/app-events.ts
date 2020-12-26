export enum CitiesSeederEvents {
  NEW_CITY = 'cities.seeder.new',
  SEEDING_FINISHED = 'cities.seeder.finished',
}

export enum IndexesEvents {
  NEW_INDEXES = 'indexes.new',
}

export enum CitiesRepositoryEvents {
  CITIES_READY = 'cities.repository.ready',
}

export enum SuggestionsEvents {
  SUGGESTION_GENERATED = 'suggestions.generated',
  SUGGESTION_RETURNED = 'suggestions.returned',
}