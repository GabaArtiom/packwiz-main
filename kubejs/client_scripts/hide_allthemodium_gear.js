JEIEvents.hideItems(event => {
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
      event.hide(`allthemodium:${material}_${gear}`)
    }
  }

  for (const gear of ['sword', 'axe', 'shovel', 'paxel']) {
    event.hide(`allthemodium:alloy_${gear}`)
  }
})
