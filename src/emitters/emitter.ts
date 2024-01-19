import {Entity} from '../model/entity'

export interface Emitter {
   emit(entity: Entity): void
}