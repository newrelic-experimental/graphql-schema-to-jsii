import {GraphQLArgument, GraphQLEnumType, GraphQLField, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLType} from "graphql";
import {GraphQLUnionType} from "graphql/type/definition";

export class Document {
   private variableMap: Map<string, GraphQLArgument> = new Map()

   public constructor() {
   }

   public getMutation(mutation: GraphQLField<any, any>): string {
      // The "type" of a mutation is its result, so we don't want field variables here
      const body = this.splunk(mutation.type)
      let value: string = this.header(mutation) + body
      value = value + this.footer(mutation)
      return value
   }

   public getQuery(query: GraphQLField<any, any>): string {
      const body = this.splunk(query.type)
      let value: string = this.queryHeader(query) + body
      value = value + this.queryFooter(query)
      return value
   }

   private parseField(type: GraphQLType): string {
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
      return `string // FIXME ${type}`
   }

   // Field variables are variable: $variableName

   // Document variables are $variableName: type
   private documentVariables(args: readonly GraphQLArgument[]): string {
      // This is a bit wonky but it due to the ordering of the header output
      args.forEach((v) => {
         this.variableMap.set(v.name, v)
      })
      let value = ''
      this.variableMap.forEach((v, _k) => {
         //args.forEach((v: GraphQLArgument) => {
         let f = this.parseField(v.type)
         value = value + ` \$${v.name}: ${f},`

      })
      if (!(value == '')) {
         value = `( ${value} )`
      }
      return value
   }

   // @ts-ignore
   private fieldVariables(args: readonly GraphQLArgument[]): string {
      let value = ''
      args.forEach((v: GraphQLArgument) => {
         value = value + ` ${v.name}: \$${v.name},`
         this.variableMap.set(v.name, v)
      })
      if (!(value == '')) {
         value = `( ${value} )`
      }
      return value
   }

   // @ts-ignore
   private queryHeader(query: GraphQLField<any, any>) {
      const name = query.name.slice(0, 1).toUpperCase() + query.name.slice(1)
      let value = `export const ${name} = gql \`\nquery ${name}`
      value = `${value} ${this.documentVariables(query.args)}{`
      value = `${value}\n${query.name} ${this.fieldVariables(query.args)}`
      return value
   }

   private header(mutation: GraphQLField<any, any>) {
      const name = mutation.name.slice(0, 1).toUpperCase() + mutation.name.slice(1)
      let value = `export const ${name} = gql \`\nmutation ${name}`
      value = `${value} ${this.documentVariables(mutation.args)}{`
      value = `${value}\n${mutation.name} ${this.fieldVariables(mutation.args)}`
      return value
   }


   // @ts-ignore
   private queryFooter(query: GraphQLField<any, any>) {
      return '\n}\n`\n';
   }

   // @ts-ignore
   private footer(mutation: GraphQLField<any, any>) {
      return '\n}\n`\n';
   }

   private splunk(type: GraphQLOutputType | GraphQLField<any, any>, value = '', depth = ''): string {
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
            value = this.splunk(t, value, depth)
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
         console.warn(`documents.splunk: unknown type: ${type}`)
      }
      return value
   }

   private isGraphQLField(a: any): a is GraphQLField<any, any> {
      return ('name' in a && 'description' in a && 'type' in a && 'args' in a && 'extensions' in a && 'astNode' in a)
   }

}