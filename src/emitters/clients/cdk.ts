import {Emitter} from "../emitter";
import {Entity} from "../../model/entity";
import fs from "fs";
import {Configuration} from "../../config/configuration";
import {WriteStream} from "node:fs";
import {Mutation} from "../../model/mutation";
import {Query} from "../../model/query";

export class CDK implements Emitter {
   config: Configuration = Configuration.getInstance()

   emit(entity: Entity): void {
      const stream = fs.createWriteStream(`${this.config.getOutputDirectory()}/${entity.name}-cdk-client.ts`)
      this.header(entity, stream)
      entity.getDocuments().forEach((document, operation) => {
         this.generate(stream, operation, document, entity)
      })
      this.footer(stream)
      stream.close()
   }

   private argsToDocumentParameters(doc: Mutation | Query): string {
      let value = ''
      doc.getArguments().forEach((v, _k) => {
         //args.forEach((v: GraphQLArgument) => {
         value = value + ` ${v.name}: ${v.name},`
      })
      return value
   }

   private argsToFunctionParameters(doc: Mutation | Query, name: string): string {
      let value = ''
      doc.getArguments().forEach((v, _k) => {
         //args.forEach((v: GraphQLArgument) => {
         let f = doc.parseField(v.type)
         f = f.replace(/!/g, '')
         value = value + `${v.name}: ${name}.${f}, `
      })
      return value
   }

   private footer(stream: WriteStream) {
      stream.write(`}`)
   }

   // @ts-ignore
   private generate(stream: WriteStream, operation: string, document: Mutation | Query, entity: Entity) {
      // TODO Figure-out how to detect and deal with paged operations
      // TODO Deal with required/optional args
      const functionParameters = this.argsToFunctionParameters(document, entity.name)

      // TODO Query returnType has to be wrapped in data, so we need to know that this *is* a Query
      const returnType = document.getReturnValue()
      const parametersAsVariables = this.argsToDocumentParameters(document)
      const body = `

   async ${operation}(${functionParameters}): Promise<${entity.name}.${returnType}> {
      return this.client.request(${entity.name}.${document.getDocumentName()}, {
        ${parametersAsVariables}
      })
   }`
      stream.write(body)
   }

   private header(entity: Entity, stream: WriteStream) {
      // TODO Output directory from config
      const header = `
import { Construct } from 'constructs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { GraphQLClient } from 'graphql-request';

import * as ${entity.name} from './${entity.name}-types'

export * from './${entity.name}-types'

export interface IClientConfiguration {
  key: string;
  endpoint?: string;
}

export class ${entity.name}Manager extends Construct {
  private defaultEndpoint: string = 'https://api.newrelic.com/graphql';
  private client: GraphQLClient;

  constructor(scope: Construct, id: string, config: IClientConfiguration) {
    super(scope, id);

    if (config == null) {
      throw 'Missing required configuration';
    }

    if (config.key == null || config.key.trim() == '') {
      throw 'License key is required';
    }

    if (config.endpoint == null || config.endpoint.trim() == '') {
      config.endpoint = this.defaultEndpoint;
      console.info('Using default NerdGraph endpoint: ' + config.endpoint);
    }

    this.client = new GraphQLClient(config.endpoint,
      {
        headers: { 'API-Key': config.key },
      },
    );
  }

`
      stream.write(header)
   }
}