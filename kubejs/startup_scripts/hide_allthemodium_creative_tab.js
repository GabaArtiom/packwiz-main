const blockedAllthemodiumGear = []

for (const material of ['allthemodium', 'vibranium', 'unobtainium']) {
  for (const gear of ['helmet', 'chestplate', 'leggings', 'boots', 'sword', 'pickaxe', 'axe', 'shovel']) {
    blockedAllthemodiumGear.push(`allthemodium:${material}_${gear}`)
  }
}

for (const gear of ['sword', 'axe', 'shovel', 'paxel']) {
  blockedAllthemodiumGear.push(`allthemodium:alloy_${gear}`)
}

for (const tab of ['allthemodium:creative_tab', 'allthemodium:allthemodium', 'allthemodium:allthemodium_tab', 'allthemodium:main']) {
  StartupEvents.modifyCreativeTab(tab, event => {
    for (const item of blockedAllthemodiumGear) {
      event.remove(item)
    }
  })
}
