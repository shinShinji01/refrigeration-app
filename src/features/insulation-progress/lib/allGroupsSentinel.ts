// Ключ для pendingGroupIds, которым помечается глобальное bulk-действие
// (widgets/insulation-global-actions) — setGroupDone трактует groupId как
// непрозрачный идентификатор и ни на что другое не влияет, так что здесь
// достаточно константы, не пересекающейся с реальными group.linkId.
export const ALL_GROUPS_SENTINEL = '__all_groups__'
