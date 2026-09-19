import { writeFileSync } from 'node:fs'
const indexes = []
for (const sort of ['nameSort', 'creatorSort', 'updatedAt']) for (const direction of ['ASCENDING', 'DESCENDING']) {
  for (const creator of [false, true]) for (const collection of [false, true]) for (const search of [false, true]) {
    const fields = [{ fieldPath: 'orgId', order: 'ASCENDING' }, { fieldPath: 'deleted', order: 'ASCENDING' }]
    if (creator) fields.push({ fieldPath: 'createdBy.uid', order: 'ASCENDING' })
    if (collection) fields.push({ fieldPath: 'collectionId', order: 'ASCENDING' })
    if (search) fields.push({ fieldPath: 'prefixes', arrayConfig: 'CONTAINS' })
    fields.push({ fieldPath: sort, order: direction }, { fieldPath: '__name__', order: direction })
    indexes.push({ collectionGroup: 'library', queryScope: 'COLLECTION', fields })
  }
}
writeFileSync('firestore.indexes.json', JSON.stringify({ indexes, fieldOverrides: [
  { collectionGroup: 'body', fieldPath: 'data', indexes: [] },
  { collectionGroup: 'library', fieldPath: 'prefixes', indexes: [] },
  { collectionGroup: 'assets', fieldPath: 'createdAt', indexes: [{ order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' }] },
  { collectionGroup: 'library', fieldPath: 'id', indexes: [{ order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' }] },
] }, null, 2) + '\n')
