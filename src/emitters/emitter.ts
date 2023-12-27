import {Group} from '../../index'

export interface Emitter {
   emit(k: string, v: Group): void
}