import {Configuration} from './src/config/configuration'
import {Entity} from './src/graphql/entity'
import {logger} from "bs-logger";

const config = Configuration.getInstance()

function main() {
   const entities: Entity[] = []

   config.getEntities().forEach((entityConfig) => {
      try {
         entities.push(new Entity(entityConfig))
      } catch (error) {
         logger.error(`Error processing entity ${entityConfig.name}: ${error}`)
      }
   })

   for (let emitter of config.getEmitters()) {
      for (let entity of entities) {
         emitter.emit(entity)
      }
   }
}

main()