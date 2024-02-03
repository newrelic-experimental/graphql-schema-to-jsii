import {argsToArgsConfig} from "graphql/type/definition";
import {Configuration, EntityConfig, FieldConfig, logger} from "../config/configuration";
import {
   GraphQLEnumType, GraphQLField, GraphQLFieldMap, GraphQLInputField, GraphQLInputFieldMap, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLType, GraphQLUnionType,
   isInterfaceType, isObjectType,
} from "graphql";
import {ObjMap} from "graphql/jsutils/ObjMap";
import {Mutation} from "./mutation";
import {Query} from "./query";

export type Mutations = Record<string, GraphQLField<any, any> | undefined> & {
   create: GraphQLField<any, any> | undefined
   update: GraphQLField<any, any> | undefined
   delete: GraphQLField<any, any> | undefined
}
export type Queries = Record<string, GraphQLField<any, any> | undefined> & {
   read: GraphQLField<any, any> | undefined
   list: GraphQLField<any, any> | undefined
}

export class Entity {
   //public readonly mutations: Mutations
   public readonly name: string
   //public readonly queries: Queries
   public readonly types: Map<string, GraphQLType> = new Map();
   private config = Configuration.getInstance()
   private documents: Map<string, Mutation | Query> = new Map()

   constructor(entityConfig: EntityConfig) {
      this.name = entityConfig.name
      //this.mutations = {create: undefined, delete: undefined, update: undefined}
      //this.queries = {read: undefined, list: undefined}

      if (entityConfig.mutations) {
         for (const operation of Object.getOwnPropertyNames(entityConfig.mutations)) {
            if (entityConfig.mutations [operation]) {
               const field = this.getField(entityConfig.mutations[operation], this.config.schema?.getMutationType()?.getFields())
               if (field) {
                  this.splunk(field, this.types)
                  //this.mutations[operation] = field
                  this.documents.set(operation, new Mutation(this.name, operation, field))
               }
            }
         }
      }

      if (entityConfig.queries) {
         for (const operation of Object.getOwnPropertyNames(entityConfig.queries)) {
            if (entityConfig.queries [operation]) {
               // FIXME queries need a top level "data": wrapper
               const field = this.getField(entityConfig.queries[operation], this.config.schema?.getQueryType()?.getFields())
               if (field) {
                  this.splunk(field, this.types)
                  //this.queries[operation] = field
                  this.documents.set(operation, new Query(this.name, operation, field))
               }
            }
         }
      }
   }

   public getDocuments(): Map<string, Mutation | Query> {
      return this.documents
   }

   // This cannot return a GraphQLField because args MUST BE an object and not an array!
   private asField(graphQLField: GraphQLField<any, any>, type: GraphQLObjectType | GraphQLInterfaceType, fieldConfig: FieldConfig): {} {
      let extension = {}
      if (fieldConfig.fragmentName) {
         // @ts-ignore
         extension['FRAGMENTNAME'] = fieldConfig.fragmentName
      }
      if (fieldConfig.alias) {
         // @ts-ignore
         extension['ALIAS'] = fieldConfig.alias
      }
      let result = {}
      if (graphQLField) {
         for (const [k, v] of Object.entries(graphQLField.extensions)) {
            // @ts-ignore
            extension[k] = v
         }
         result = {
            name:              graphQLField.name,
            description:       graphQLField.description,
            type:              type,
            args:              argsToArgsConfig(graphQLField.args),
            resolve:           graphQLField.resolve,
            subscribe:         graphQLField.subscribe,
            deprecationReason: graphQLField.deprecationReason,
            extensions:        extension,
            astNode:           graphQLField.astNode,
         }
      } else {
         result = {
            name:              type.name,
            description:       undefined,
            type:              type,
            args:              {},
            resolve:           undefined,
            subscribe:         undefined,
            deprecationReason: undefined,
            extensions:        extension,
            astNode:           undefined,

         }
      }
      return result
   }

   private buildField(originalField: GraphQLField<any, any>, fieldConfig: FieldConfig): GraphQLField<any, any> {
      //logger.debug(`buildField: ${fieldConfig.name}`)
      let extensions = {}
      if (fieldConfig.alias) {
         // @ts-ignore
         extensions['ALIAS'] = fieldConfig.alias
      }
      const field: GraphQLField<any, any> = {
         name:              originalField.name,
         description:       originalField.description,
         type:              this.buildType(fieldConfig),
         args:              originalField.args,
         resolve:           originalField.resolve,
         subscribe:         originalField.subscribe,
         deprecationReason: originalField.deprecationReason,
         extensions:        extensions,
         astNode:           originalField.astNode,
      }
      return field
   }

   private buildInterfaceType(originalType: GraphQLInterfaceType, fieldConfig: FieldConfig): GraphQLInterfaceType {
      //logger.debug(`buildInterfaceType: ${fieldConfig.name}`)
      // Build the field map for the new object
      // BE VERY CAREFUL to mutate only typeConfig
      const typeConfig = originalType.toConfig()
      const originalFieldMap = originalType.getFields()
      let newFieldMap: ObjMap<any> = {}
      if (!fieldConfig.prune) {
         // We're not pruning so grab the original fields
         newFieldMap = typeConfig.fields
      }

      if (fieldConfig.alias) {
         typeConfig.name = fieldConfig.alias
         // @ts-ignore
         typeConfig.extensions['ALIAS'] = fieldConfig.alias
      }
      // Replace or create the subfields
      if (fieldConfig.subFields) {
         for (let subField of fieldConfig.subFields) {
            const type = this.buildType(subField)
            newFieldMap[subField.name] = this.asField(originalFieldMap[subField.name], type, subField)
         }
      }
      typeConfig.fields = newFieldMap

      const newType = new GraphQLInterfaceType(typeConfig)
      return newType
   }

   private buildObjectType(originalType: GraphQLObjectType, fieldConfig: FieldConfig): GraphQLObjectType {
      //logger.debug(`buildObjectType: ${fieldConfig.name}`)

      // Build the field map for the new object
      // BE VERY CAREFUL to mutate only typeConfig
      const typeConfig = originalType.toConfig()
      const originalFieldMap = originalType.getFields()
      let newFieldMap: ObjMap<any> = {}
      if (!fieldConfig.prune) {
         // We're not pruning so grab the original fields
         newFieldMap = typeConfig.fields
      }
      if (fieldConfig.alias) {
         typeConfig.name = fieldConfig.alias
         // @ts-ignore
         typeConfig.extensions['ALIAS'] = fieldConfig.alias
      }

      // Replace or create the subfields
      if (fieldConfig.subFields) {
         for (let subField of fieldConfig.subFields) {
            const type = this.buildType(subField)
            newFieldMap[subField.name] = this.asField(originalFieldMap[subField.name], type, subField)
         }
      }
      typeConfig.fields = newFieldMap

      const newType = new GraphQLObjectType<any, any>(typeConfig)
      return newType
   }

   private buildType(fieldConfig: FieldConfig): GraphQLObjectType | GraphQLInterfaceType {
      //logger.debug(`buildType: ${fieldConfig.name}`)
      const originalType = this.config.schema?.getType(fieldConfig.type)
      if (!originalType) {
         throw new Error(`Underlying type not found: ${fieldConfig.type}`)
      }

      if (isObjectType(originalType)) {
         return this.buildObjectType(originalType, fieldConfig)
      } else if (isInterfaceType(originalType)) {
         return this.buildInterfaceType(originalType, fieldConfig)
      } else {
         throw new Error(`Type has no fields: ${originalType}`)
      }
   }

   // getField deals with the top level field under mutation/query. If we did a look ahead through the entire FieldConfig chain and found no pruning we could actually return the original- but we don't
   private getField(field: FieldConfig[] | undefined, fieldMap: GraphQLFieldMap<any, any> | undefined): (GraphQLField<any, any> | undefined) {
      if (field && fieldMap) {
         if (field.length != 1) {
            throw new Error(`Top level fieldConfig should only contain one field: ${field}`)
         }
         const rootField = fieldMap[field[0].name]
         if (!rootField) {
            throw new Error(`Unable to find root field: ${field[0].name}`)
         }
         return this.buildField(rootField, field[0])
      }
      return undefined
   }

   private isGraphQLField(a: any): a is GraphQLField<any, any> {
      return ('name' in a && 'description' in a && 'type' in a && 'args' in a && 'deprecationReason' in a && 'extensions' in a && 'astNode' in a)
   }

   private isGraphQLInputField(a: any): a is GraphQLInputField {
      return ('name' in a && 'description' in a && 'type' in a && 'defaultValue' in a && 'deprecationReason' in a && 'extensions' in a && 'astNode' in a)
   }

   private splunk(type: GraphQLType | GraphQLField<any, any> | GraphQLInputField, types: Map<string, GraphQLType>) {
      if (!type) {
         logger.warn("entity.splunk: type undefined")
         return
      }
      if (('deprecationReason' in type) && type.deprecationReason != undefined) {
         return
      }

      if (type instanceof GraphQLScalarType) {
         types.set(type.name, type)

      } else if (type instanceof GraphQLObjectType) {
         types.set(type.name, type)
         this.splunkFields(type.getFields(), types)

      } else if (type instanceof GraphQLInterfaceType) {
         types.set(type.name, type)
         this.splunkFields(type.getFields(), types)
         this.splunkInterfaces(type.getInterfaces(), types)

      } else if (type instanceof GraphQLUnionType) {
         types.set(type.name, type)
         this.splunkTypes(type.getTypes(), types)

      } else if (type instanceof GraphQLEnumType) {
         // GraphQL Enums are lists of strings, nothing else to do here
         types.set(type.name, type)

      } else if (type instanceof GraphQLNonNull) {
         // Wrapper for a required field
         this.splunk(type.ofType, types)

      } else if (type instanceof GraphQLInputObjectType) {
         types.set(type.name, type)
         this.splunkFields(type.getFields(), types)

      } else if (type instanceof GraphQLList) {
         // Wrapper for a list
         this.splunk(type.ofType, types)
         // Case of almost last resort
      } else if (this.isGraphQLField(type)) {
         this.splunk(type.type, types)
         type.args.forEach((arg) => {
            logger.debug(`splunk: field: arg: ${arg.name}: ${arg.type}`)
            this.splunk(arg.type, types)
         })
      } else if (this.isGraphQLInputField(type)) {
         logger.debug(`entity.splunk: GraphQLInputField type: ${type.name}`)
      } else {
         logger.warn(`entity.splunk: Unknown type: ${type}`)
      }
      return
   }

   private splunkFields(fields: GraphQLFieldMap<any, any> | GraphQLInputFieldMap, types: Map<string, GraphQLType>) {
      for (let fieldsKey in fields) {
         const field = fields[fieldsKey]
         this.splunk(field.type, types)
         if (this.isGraphQLField(field)) {
            field.args.forEach((arg) => {
               logger.debug(`splunkFields: field: arg: ${arg.name}: ${arg.type}`)
               this.splunk(arg.type, types)
            })
         }
      }
   }

   // DIRE WARNING!

   private splunkInterfaces(interfaces: ReadonlyArray<GraphQLInterfaceType>, types: Map<string, GraphQLType>) {
      interfaces.forEach((i) => {
         this.splunk(i, types)
      })
   }

   private splunkTypes(typeArray: ReadonlyArray<GraphQLObjectType>, types: Map<string, GraphQLType>) {
      typeArray.forEach((t) => {
         this.splunk(t, types)
      })
   }
}