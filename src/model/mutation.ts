import {Document} from './document'
import {GraphQLField} from "graphql/index";

export class Mutation extends Document {

   public constructor(entityName: string, operation: string, field: GraphQLField<any, any>) {
      super(entityName, operation, field)
      const body = this.splunk(field.type)
      let value: string = this.getHeader() + body
      value = value + this.getFooter()
      this.document = value
   }

   protected getFooter() {
      return '\n}\n`\n';
   }

   protected getHeader(): string {
      // const name = this.operation[0].toUpperCase() + this.operation.slice(1) + this.entityName[0].toUpperCase() + this.entityName.slice(1)
      const name = this.getDocumentName()
      //let value = `export const ${name} = gql \`\nmutation ${name}`
      let value = `mutation ${name}`
      value = `${value} ${this.documentVariables(this.field.args)}{`
      value = `${value}\n${this.buildName(this.field)} ${this.fieldVariables(this.field.args)}`
      return value
   }
}