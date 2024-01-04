import {Configuration} from '../../src/config/configuration'

test('inQueryPath: Before the Entity', () => {
   const c = Configuration.getInstance()
   expect(c.inQueryPath('actor.entity.name')).toBe(true)
})

test('inQueryPath: On the Entity', () => {
   const c = Configuration.getInstance()
   expect(c.inQueryPath('actor.entity.DashboardEntity')).toBe(true)
})

test('inQueryPath: After the Entity', () => {
   const c = Configuration.getInstance()
   expect(c.inQueryPath('actor.entity.DashboardEntity.name')).toBe(true)
})

test('inQueryPath: Wrong Entity', () => {
   const c = Configuration.getInstance()
   expect(c.inQueryPath('actor.entity.AlertableEntity')).toBe(false)
})

