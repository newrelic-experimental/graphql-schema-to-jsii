import {Emitter} from "../emitter";
import {GraphQLField, GraphQLInputField, GraphQLType} from "graphql";
import {GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLNonNull, GraphQLScalarType, GraphQLUnionType} from "graphql/type/definition";
import {GraphQLList, GraphQLObjectType} from "graphql/index";
import * as fs from "fs";
import {WriteStream} from "node:fs";
import {Entity} from "../../model/entity";
import {logger} from '../../config/configuration'

export class Jsii implements Emitter {

   static Scalars: Record<string, string> = {
      String:                          'string',
      EntityGuid:                      'string',
      Int:                             'string', // JSII does not support bigint
      Nrql:                            'string',
      Float:                           'number',
      ID:                              'string',
      DashboardWidgetRawConfiguration: 'string',
      DateTime:                        'string',
      EpochMilliseconds:               'string',
      Boolean:                         'boolean',
      Milliseconds:                    'string',
      AttributeMap:                    'Record<string, any>',
      EntityAlertViolationInt:         'string',
      NerdStorageDocument:             'string',
      NrdbResult:                      'string',
      Seconds:                         'string',
      NrdbRawResults:                  'string',
      SecureValue:                     'string',
      NaiveDateTime:                   'string',
   }

   outputDir: string

   public constructor(outputDir: string) {
      this.outputDir = outputDir
   }

   public emit(entity: Entity): void {
      const stream = fs.createWriteStream(`${this.outputDir}/${entity.name}-types.ts`)
      this.header(stream)

      entity.getDocuments().forEach((document, operation) => {
         const name = operation[0].toUpperCase() + operation.slice(1) + entity.name[0].toUpperCase() + entity.name.slice(1)
         stream.write(`export const ${name} = gql \`${document.getDocument()}`)
      })

      entity.types.forEach((v) => {
         this.typeToJsiiType(v, stream)
      })

      this.footer(stream)
      stream.close()
   }

   private footer(_stream: WriteStream) {
   }

   private header(stream: WriteStream) {
      stream.write('// Code generated by graphql-schema-to-jsii, changes will be undone by the next invocation. DO NOT EDIT.\n')
      stream.write(`// Generated at: ${new Date()}\n`)
      stream.write('import {gql} from "graphql-request"\n\n')
      for (const key in Jsii.Scalars) {
         //stream.write(`export type ${key}\n`)
         stream.write(`export type ${key} = ${Jsii.Scalars[key]}\n`)
      }
   }

   private isDeprecated(thing: GraphQLType | GraphQLField<any, any> | GraphQLInputField) {
      if (('deprecationReason' in thing) && thing.deprecationReason != undefined) {
         return true
      }
      return false
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
         if (!this.isDeprecated(field)) {
            const parsed = this.parseField(field.type)
            line = line + `\t${fieldName}${parsed.required}: ${parsed.type}${parsed.array}\n`
         }
      }
      line = line + `}\n`
      stream.write(line)
   }

   private jsiiInterface(type: GraphQLInterfaceType, stream: WriteStream) {
      let line = `export class ${type.name} {\n`
      const fields = type.getFields()
      for (const fieldName in fields) {
         const field = fields[fieldName]
         if (!this.isDeprecated(field)) {
            const parsed = this.parseField(field.type)
            line = line + `\t${fieldName}${parsed.required}: ${parsed.type}${parsed.array}\n`
         }
      }
      line = line + `}\n`
      stream.write(line)
   }

   private jsiiList(type: GraphQLList<GraphQLType>, stream: WriteStream) {
      const line = `// jsii.jsiiList: FIXME GraphQLList: ${type.ofType}\n`
      stream.write(line)
   }

   private jsiiNonNull(type: GraphQLNonNull<GraphQLScalarType | GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType | GraphQLEnumType | GraphQLInputObjectType | GraphQLList<GraphQLType>>, stream: WriteStream) {
      const line = `// jsii.jsiiNonNull: FIXME GraphQLNonNull: ${type.ofType}\n`
      stream.write(line)
   }

   private jsiiObject(type: GraphQLObjectType<any, any>, stream: WriteStream) {
      let line = `export class ${type.name} {\n`
      const fields = type.getFields()
      for (const fieldName in fields) {
         const field = fields[fieldName]
         if (!this.isDeprecated(field)) {
            const parsed = this.parseField(field.type)
            line = line + `\t${fieldName}${parsed.required}: ${parsed.type}${parsed.array}\n`
         }
      }
      line = line + `}\n`
      stream.write(line)
   }

   /*
   GraphQL only has 3 types- object, scalar, and enum. (https://graphql.org/learn/schema/#lists-and-non-null)
   Everything else is a modifier/decorator.
    */
   private jsiiScalar(type: GraphQLScalarType<any, any>, stream: WriteStream) {
      if (!(type.name in Jsii.Scalars)) {
         logger.warn("jsiiScalar: Unknown: jsiiScalar: scalar:", type)
         const line = `// jsii.jsiiScalar: FIXME unknown scalar: ${type.name}\nexport type ${type.name} = string\n`
         stream.write(line)
      }
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

   private parseField(type: GraphQLType,
      value = {
         type:     '',
         array:    '',
         required: '?'
      }): {
      type: string,
      array: string,
      required: string
   } {
      if (('name' in type) && (type.name == 'errors')) {
         logger.debug(`jsii.parseField: errors ${type}`)
      }
      // if (value.array == '[]') {
      //    return value
      // }
      if (this.isDeprecated(type)) {
         return value
      }
      if (type instanceof GraphQLList) {
         value.array = '[]'
         value = this.parseField(type.ofType, value)
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
      if (type instanceof GraphQLUnionType) {
         value.type = `${type.name}`
         return value
      }
      if (type instanceof GraphQLScalarType) {
         value.type = `${type.name}`
         return value
      }
      if (type instanceof GraphQLNonNull) {
         if (value.array == '[]') {
         } else {
            value.required = '!'
         }
         value = this.parseField(type.ofType, value)
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
      value.type = `string // jsii.parseField: FIXME ${type}`
      return value
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
         logger.warn("typeToJsiiType: Unknown type: ", type)
      }
   }
}