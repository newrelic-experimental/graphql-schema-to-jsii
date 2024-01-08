import {Entity} from '../graphql/entity'

export interface Emitter {
   emit(entity: Entity): void
}