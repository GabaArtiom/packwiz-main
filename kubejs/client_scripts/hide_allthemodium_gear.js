RecipeViewerEvents.removeEntriesCompletely('item', event => {
  const materials = ['allthemodium', 'vibranium', 'unobtainium']
  const hiddenGear = [
    'helmet',
    'chestplate',
    'leggings',
    'boots',
    'sword',
    'pickaxe',
    'axe',
    'shovel'
  ]

  for (const material of materials) {
    for (const gear of hiddenGear) {
      event.remove(`allthemodium:${material}_${gear}`)
    }
  }

  for (const gear of ['sword', 'axe', 'shovel', 'paxel']) {
    event.remove(`allthemodium:alloy_${gear}`)
  }
})
