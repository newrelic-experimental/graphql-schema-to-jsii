import {Configuration} from './src/config/configuration'
import {Entity} from './src/graphql/entity'

const config = Configuration.getInstance()

function main() {
   const entities: Entity[] = []

   config.getEntities().forEach((entityConfig) => {
      entities.push(new Entity(entityConfig))
   })

   for (let emitter of config.getEmitters()) {
      for (let entity of entities) {
         emitter.emit(entity)
      }
   }
}

main()