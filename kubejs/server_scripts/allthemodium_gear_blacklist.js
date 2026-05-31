ServerEvents.recipes(event => {
  const materials = ['allthemodium', 'vibranium', 'unobtainium']
  const blockedGear = [
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
    for (const gear of blockedGear) {
      event.remove({ output: `allthemodium:${material}_${gear}` })
    }
  }

  for (const gear of ['sword', 'axe', 'shovel', 'paxel']) {
    event.remove({ output: `allthemodium:alloy_${gear}` })
  }
})
