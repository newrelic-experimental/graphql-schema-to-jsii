import {GraphQLArgument, GraphQLEnumType, GraphQLField, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLType, GraphQLUnionType} from "graphql";
import {logger} from '../config/configuration'

export abstract class Document {
   protected document: string = ''
   protected entityName: string;
   protected field: GraphQLField<any, any>;
   protected operation: string;
   protected parameters: Map<string, GraphQLArgument> = new Map()

   protected constructor(entityName: string, operation: string, field: GraphQLField<any, any>) {
      this.entityName = entityName
      this.operation = operation
      this.field = field
   }

   public getDocument(): string {
      return this.document
   }


   public getParameters(): Map<string, GraphQLArgument> {
      return this.parameters
   }

   public getReturnValue(): GraphQLOutputType {
      return this.field.type
   }

   // Document variables are $variableName: type
   protected documentVariables(args: readonly GraphQLArgument[]): string {
      // This is a bit wonky but it due to the ordering of the mutationHeader output
      args.forEach((v) => {
         this.parameters.set(v.name, v)
      })
      let value = ''
      this.parameters.forEach((v, _k) => {
         //args.forEach((v: GraphQLArgument) => {
         let f = this.parseField(v.type)
         value = value + ` \$${v.name}: ${f},`

      })
      if (!(value == '')) {
         value = `( ${value} )`
      }
      return value
   }

   protected fieldVariables(args: readonly GraphQLArgument[]): string {
      let value = ''
      args.forEach((v: GraphQLArgument) => {
         value = value + ` ${v.name}: \$${v.name},`
         this.parameters.set(v.name, v)
      })
      if (!(value == '')) {
         value = `( ${value} )`
      }
      return value
   }

   // Field variables are variable: $variableName

   protected abstract getFooter(): string

   protected abstract getHeader(): string

   protected isGraphQLField(a: any): a is GraphQLField<any, any> {
      return ('name' in a && 'description' in a && 'type' in a && 'args' in a && 'extensions' in a && 'astNode' in a)
   }


   protected parseField(type: GraphQLType): string {
      if (type instanceof GraphQLList) {
         return `[ ${this.parseField(type.ofType)} ]`
      }
      if (type instanceof GraphQLObjectType) {
         return type.name
      }
      if (type instanceof GraphQLInterfaceType) {
         return type.name
      }
      if (type instanceof GraphQLScalarType) {
         return type.name
      }
      if (type instanceof GraphQLNonNull) {
         return `${this.parseField(type.ofType)}!`
      }
      if (type instanceof GraphQLEnumType) {
         return type.name
      }
      if (type instanceof GraphQLInputObjectType) {
         return type.name
      }

      // Fall-through case
      return `string // document.parseField: FIXME ${type}`
   }


   protected splunk(type: GraphQLOutputType | GraphQLField<any, any>, value = '', depth = ''): string {
      if (!type) {
         logger.warn(`document.splunk: type is undefined`)
         return value
      }
      if (('deprecationReason' in type) && type.deprecationReason != undefined) {
         return value
      }
      depth = depth + '\t'

      if (type instanceof GraphQLScalarType) {
         return value

      } else if (type instanceof GraphQLObjectType) {
         if (type)
            value = `${value} {`
         for (const fn in type.getFields()) {
            value = this.splunk(type.getFields()[fn], value, depth)
         }
         return `${value}\n${depth}}`

      } else if (type instanceof GraphQLInterfaceType) {
         //value = `${value}\n${depth}${type.name} {`
         value = `${value} {`
         for (const fn in type.getFields()) {
            value = this.splunk(type.getFields()[fn], value, depth)
         }
         return `${value}\n${depth}}`

      } else if (type instanceof GraphQLUnionType) {
         type.getTypes().forEach((t) => {
            const tvalue = this.splunk(t, '', depth)
            if (tvalue.replace(/\s/g, '') != '{}') {
               value = `${value}\n${depth}... on ${t.name} ${tvalue}`
            }
            //value = this.splunk(t, value, depth)
         })
         return value

      } else if (type instanceof GraphQLEnumType) {
         // return `${value}\n${depth}${type.name}`
         return value

      } else if (type instanceof GraphQLList) {
         return this.splunk(type.ofType, value, depth)

      } else if (type instanceof GraphQLNonNull) {
         return this.splunk(type.ofType, value, depth)

      } else if (this.isGraphQLField(type)) {
         const args = this.fieldVariables(type.args)
         if ('FRAGMENTNAME' in type.extensions) {
            return this.splunk(type.type, `${value}\n${depth}${type.extensions.FRAGMENTNAME} ${args}`, depth)
         } else {
            return this.splunk(type.type, `${value}\n${depth}${type.name} ${args}`, depth)
         }

      } else {
         logger.warn(`documents.splunk: unknown type: ${type}`)
      }
      return value
   }

}