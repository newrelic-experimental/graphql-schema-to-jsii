import {Configuration} from '../../src/config/configuration'

test('Before the Entity', () => {
   const c = Configuration.getInstance()
   expect(c.inQueryPath('dashboard', 'actor.entity.name')).toBe(true)
})

test('After the Entity', () => {
   const c = Configuration.getInstance()
   expect(c.inQueryPath('Dashboard', 'actor.entity.DashboardEntity.name')).toBe(true)
})

test('On the Entity', () => {
   const c = Configuration.getInstance()
   expect(c.inQueryPath('Dashboard', 'actor.entity.DashboardEntity')).toBe(true)
})

test('Wrong Entity', () => {
   const c = Configuration.getInstance()
   expect(c.inQueryPath('Dashboard', 'actor.entity.AlertableEntity.name')).toBe(false)
})

