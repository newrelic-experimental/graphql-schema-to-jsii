import {Jsii} from "../../../src/emitters/jsii/jsii";
import fs from "fs";
import {buildSchema, GraphQLObjectType} from "graphql/index";
import {GraphQLSchema} from "graphql/type";
import {expect, test} from '@jest/globals'

let schema: GraphQLSchema

beforeAll(() => {
   console.log('beforeAll ' + new Date());
   const buffer = fs.readFileSync('./test/emitters/jsii/test-schema.graphql', 'utf-8')
   schema = buildSchema(buffer)
})

test.each([{type: 'Required', expected: {type: 'String', array: '', required: '!'}},
             {type: 'Optional', expected: {type: 'String', array: '', required: '?'}},
             {type: 'OptionalList', expected: {type: 'String', array: '[]', required: '?'}},
             {type: 'RequiredListOfOptional', expected: {type: 'String', array: '[]', required: '!'}},
             {type: 'RequiredListOfRequired', expected: {type: 'String', array: '[]', required: '!'}}])
('$type', ({type, expected}) => {
   console.log(`${type} ` + new Date());
   const jsii = new Jsii("")
   const t = schema.getType(type)
   if (t && t instanceof GraphQLObjectType) {
      const f = t.getFields()['someField']
      expect(jsii['parseField'](f.type)).toStrictEqual(expected)
   }

})