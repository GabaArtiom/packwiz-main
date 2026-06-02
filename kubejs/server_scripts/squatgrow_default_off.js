if (Platform.isLoaded('squatgrow')) {
  PlayerEvents.loggedIn(event => {
    const defaultedKey = 'safonov_squatgrow_defaulted'
    const squatGrowNeoForge = Java.loadClass('dev.wuffs.squatgrow.neoforge.SquatGrowNeoForge')
    const player = event.player

    if (player.persistentData.contains(defaultedKey)) {
      return
    }

    player.setData(squatGrowNeoForge.SQUAT_GROW_ENABLED.get(), false)
    player.persistentData.putBoolean(defaultedKey, true)
  })
}
