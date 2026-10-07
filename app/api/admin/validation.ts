import {z} from 'zod';
import type {AdminMutation} from '@/lib/admin/types';

const revision = z.number().int().min(0).max(999999999);
const id = z.string().uuid();
const role = z.enum(['owner', 'admin', 'operator', 'analyst']);
const reason = z.string().trim().min(10).max(500);
const status = z.enum(['todo', 'in_progress', 'done']);
const dueDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '0001-01-01';
}).nullable();
const taskFields = {
  revision, id, title: z.string().trim().min(1).max(140), description: z.string().max(3000),
  status, priority: z.enum(['low', 'medium', 'high']), dueDate,
};

export const adminMutationSchema: z.ZodType<AdminMutation> = z.discriminatedUnion('action', [
  z.object({action: z.literal('task.create'), ...taskFields}).strict(),
  z.object({action: z.literal('task.update'), ...taskFields}).strict(),
  z.object({action: z.literal('task.delete'), revision, id}).strict(),
  z.object({action: z.literal('tasks.reorder'), revision, tasks: z.array(z.object({id, status}).strict()).max(250)}).strict(),
  z.object({action: z.literal('preferences.update'), revision, widgetOrder: z.array(z.enum(['activity', 'tasks', 'contacts', 'catalog'])).length(4)}).strict(),
  z.object({action: z.literal('contact.resolve'), id, resolved: z.boolean(), expectedResolvedAt: z.string().datetime({offset: true}).nullable()}).strict(),
  z.object({action: z.literal('access.grant'), email: z.string().trim().toLowerCase().email().max(254), role, reason, accessRevision: revision}).strict(),
  z.object({action: z.literal('access.change'), userId: id, role, reason, accessRevision: revision}).strict(),
  z.object({action: z.literal('access.revoke'), userId: id, reason, accessRevision: revision}).strict(),
]).superRefine((input, context) => {
  if (input.action === 'tasks.reorder' && new Set(input.tasks.map(task => task.id.toLowerCase())).size !== input.tasks.length) {
    context.addIssue({code: z.ZodIssueCode.custom, message: 'Duplicate task'});
  }
  if (input.action === 'preferences.update' && new Set(input.widgetOrder).size !== input.widgetOrder.length) {
    context.addIssue({code: z.ZodIssueCode.custom, message: 'Duplicate widget'});
  }
});
