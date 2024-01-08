import {Emitter} from "../emitter";
import {GraphQLField, GraphQLType} from "graphql";
import {GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLNonNull, GraphQLScalarType, GraphQLUnionType} from "graphql/type/definition";
import {GraphQLList, GraphQLObjectType} from "graphql/index";
import * as fs from "fs";
import {WriteStream} from "node:fs";
import {Document} from '../../graphql/document'
import {Entity} from "../../graphql/entity";
import {logger} from '../../config/configuration'


// import * as gqlg from 'gql-generator'

export class Jsii implements Emitter {

   static Scalars: Record<string, string> = {
      String: 'string',
      EntityGuid: 'string',
      Int: 'string', // JSII does not support bigint
      Nrql: 'string',
      Float: 'number',
      ID: 'string',
      DashboardWidgetRawConfiguration: 'string',
      DateTime: 'string',
      EpochMilliseconds: 'string',
      Boolean: 'boolean',
      Milliseconds: 'string',
      AttributeMap: '{}',
      EntityAlertViolationInt: 'string',
      NerdStorageDocument: 'string',
      NrdbResult: 'string',
      Seconds: 'string',
      NrdbRawResults: 'string',
   }

   public constructor() {
   }

   public emit(entity: Entity): void {
      const stream = fs.createWriteStream(`./local/${entity.name}-types.ts`)
      this.header(stream)

      for (const [name, field] of Object.entries(entity.mutations)) {
         if (field) {
            this.mutationToGraphQLDoc(name, field, stream)
         }
      }

      for (const [name, field] of Object.entries(entity.queries)) {
         if (field) {
            this.queryToGraphQLDoc(name, field, stream)
         }
      }

      entity.types.forEach((v) => {
         // FIXME trim actor to just what we want
         this.typeToJsiiType(v, stream)
      })

      this.footer(stream)
      stream.close()
   }

   private mutationToGraphQLDoc(name: string, v: GraphQLField<any, any>, stream: WriteStream) {
      const doc = new Document()
      stream.write(doc.getMutation(name, v))
   }


   private queryToGraphQLDoc(name: string, v: GraphQLField<any, any>, stream: WriteStream) {
      const doc = new Document()
      stream.write(doc.getQuery(name, v))
   }

   private typeToJsiiType(type: GraphQLType, stream: WriteStream) {
      if (type instanceof GraphQLScalarType) {
         this.jsiiScalar(type, stream)
      } else if (type instanceof GraphQLObjectType) {
         this.jsiiObject(type, stream)
      } else if (type instanceof GraphQLInterfaceType) {
         this.jsiiInterface(type, stream)
      } else if (type instanceof GraphQLUnionType) {
         this.jsiiUnion(type, stream)
      } else if (type instanceof GraphQLEnumType) {
         this.jsiiEnum(type, stream)
      } else if (type instanceof GraphQLInputObjectType) {
         this.jsiiInputObject(type, stream)
      } else if (type instanceof GraphQLNonNull) {
         this.jsiiNonNull(type, stream)
      } else if (type instanceof GraphQLList) {
         this.jsiiList(type, stream)
      } else {
         logger.error("typeToJsiiType: Unknown type: ", type)
      }
   }

   /*
   GraphQL only has 3 types- object, scalar, and enum. (https://graphql.org/learn/schema/#lists-and-non-null)
   Everything else is a modifier/decorator.
    */
   private jsiiScalar(type: GraphQLScalarType<any, any>, stream: WriteStream) {
      if (!(type.name in Jsii.Scalars)) {
         logger.error("jsiiScalar: Unknown: jsiiScalar: scalar:", type)
         const line = `// FIXME unknown scalar\nexport type ${type.name} = string\n`
         stream.write(line)
      }
   }

   private jsiiObject(type: GraphQLObjectType<any, any>, stream: WriteStream) {
      let line = `export class ${type.name} {\n`
      const fields = type.getFields()
      for (const fieldName in fields) {
         const field = fields[fieldName]
         const parsed = this.parseField(field.type)
         line = line + `\t${fieldName}${parsed.required}: ${parsed.type}${parsed.array}\n`
      }
      line = line + `}\n`
      stream.write(line)
   }

   private jsiiInterface(type: GraphQLInterfaceType, stream: WriteStream) {
      let line = `export class ${type.name} {\n`
      const fields = type.getFields()
      for (const fieldName in fields) {
         const field = fields[fieldName]
         const parsed = this.parseField(field.type)
         line = line + `\t${fieldName}${parsed.required}: ${parsed.type}${parsed.array}\n`
      }
      line = line + `}\n`
      stream.write(line)
   }

   private jsiiUnion(type: GraphQLUnionType, stream: WriteStream) {
      let line = `export type ${type.name} =`
      type.getTypes().forEach((t) => {
         line = line + ` ${t.name} |`
      })
      line = line.slice(0, -1)
      line = line + '\n'
      stream.write(line)
   }

   private jsiiEnum(type: GraphQLEnumType, stream: WriteStream) {
      let line = `export enum ${type.name} {\n`
      type.getValues().forEach((v) => {
         line = line + `\t${v.name} = '${v.value}',\n`
      })
      line = line + '}\n'
      stream.write(line)
   }

   private jsiiInputObject(type: GraphQLInputObjectType, stream: WriteStream) {
      let line = `export class ${type.name} {\n`
      const fields = type.getFields()
      for (const fieldName in fields) {
         const field = fields[fieldName]
         const parsed = this.parseField(field.type)
         line = line + `\t${fieldName}${parsed.required}: ${parsed.type}${parsed.array}\n`
      }
      line = line + `}\n`
      stream.write(line)
   }

   private jsiiNonNull(type: GraphQLNonNull<GraphQLScalarType | GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType | GraphQLEnumType | GraphQLInputObjectType | GraphQLList<GraphQLType>>, stream: WriteStream) {
      const line = `// FIXME GraphQLNonNull: ${type.ofType}\n`
      stream.write(line)
   }

   private jsiiList(type: GraphQLList<GraphQLType>, stream: WriteStream) {
      const line = `// FIXME GraphQLList: ${type.ofType}\n`
      stream.write(line)
   }

   private parseField(type: GraphQLType, value = {type: '', array: '', required: '?'}): {
      type: string,
      array: string,
      required: string
   } {
      if (type instanceof GraphQLList) {
         value = this.parseField(type.ofType)
         value.array = '[]'
         return value
      }
      if (type instanceof GraphQLObjectType) {
         value.type = type.name
         return value
      }
      if (type instanceof GraphQLInterfaceType) {
         value.type = `${type.name}`
         return value
      }
      if (type instanceof GraphQLScalarType) {
         value.type = `${type.name}`
         return value
      }
      if (type instanceof GraphQLNonNull) {
         value = this.parseField(type.ofType)
         value.required = '!'
         return value
      }
      if (type instanceof GraphQLEnumType) {
         value.type = `${type.name}`
         return value
      }
      if (type instanceof GraphQLInputObjectType) {
         value.type = type.name
         return value
      }

      // Fall-through case
      value.type = `string // FIXME ${type}`
      return value
   }

   private header(stream: WriteStream) {
      stream.write('import {gql} from "graphql-request"\n\n')
      for (const key in Jsii.Scalars) {
         //stream.write(`export type ${key}\n`)
         stream.write(`export type ${key} = ${Jsii.Scalars[key]}\n`)
      }
   }

   private footer(_stream: WriteStream) {
   }
}