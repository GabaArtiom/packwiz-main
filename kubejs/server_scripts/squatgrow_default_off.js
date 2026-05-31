const SQUATGROW_DEFAULTED_KEY = 'safonov_squatgrow_defaulted'

if (Platform.isLoaded('squatgrow')) {
  const SquatGrowNeoForge = Java.loadClass('dev.wuffs.squatgrow.neoforge.SquatGrowNeoForge')

  PlayerEvents.loggedIn(event => {
    const player = event.player

    if (player.persistentData.contains(SQUATGROW_DEFAULTED_KEY)) {
      return
    }

    player.setData(SquatGrowNeoForge.SQUAT_GROW_ENABLED.get(), false)
    player.persistentData.putBoolean(SQUATGROW_DEFAULTED_KEY, true)
  })
}
