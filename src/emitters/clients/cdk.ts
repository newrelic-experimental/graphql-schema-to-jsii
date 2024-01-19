import {Emitter} from "../emitter";
import {Entity} from "../../model/entity";
import fs from "fs";
import {Configuration} from "../../config/configuration";

export class CDK implements Emitter{
   const config: Configuration = Configuration.getInstance()
   emit(entity: Entity): void {
      const stream = fs.createWriteStream(`${this.config.getOutputDirectory()}/${entity.name}-types.ts`)
      this.header(stream)
      entity.getDocuments().forEach((document, operation) => {
         this.generate(stream, operation, document)
      })
      this.footer(stream)
      stream.close()
   }

   private header(stream: WriteStream) {
     // TODO Write header boilerplate includeing constructor
   }

   private generate(stream: WriteStream, operation: string, document: Mutation | Query) {
      // TODO Generate the method representing the operation
   }

   private footer(stream: WriteStream) {
      // TODO Write footer boilerplate
   }
}