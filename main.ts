// Neon Runner - Juego estilo Dino con efectos vibrantes

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

interface Obstacle {
  x: number
  width: number
  height: number
  type: 'cactus' | 'bird' | 'doubleCactus'
  passed: boolean
  birdY?: number // Altura personalizada para pájaros
}

interface Coin {
  x: number
  y: number
  radius: number
  rotation: number
  collected: boolean
}

interface Player {
  x: number
  y: number
  width: number
  height: number
  velocityY: number
  isJumping: boolean
  isDucking: boolean
  runFrame: number
  jumpHeld: boolean
}

interface Skin {
  id: string
  name: string
  color: string
  glow: string
  price: number
  unlocked: boolean
}

class NeonRunner {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private player: Player
  private obstacles: Obstacle[] = []
  private particles: Particle[] = []
  private coins: Coin[] = []
  private groundY: number
  private score: number = 0
  private highScore: number = parseInt(localStorage.getItem('neonRunnerHighScore') || '0')
  private totalCoins: number = parseInt(localStorage.getItem('neonRunnerCoins') || '0')
  private gameSpeed: number = 5
  private baseSpeed: number = 5
  private maxSpeed: number = 14
  private gravity: number = 0.7
  private jumpForce: number = -12
  private jumpHoldBoost: number = -0.8
  private jumpHoldMaxFrames: number = 12
  private jumpHoldFrames: number = 0
  private isGameOver: boolean = false
  private isStarted: boolean = false
  private isPaused: boolean = false
  private inMenu: boolean = true
  private inSkinMenu: boolean = false
  private groundOffset: number = 0
  private runAnimationTimer: number = 0
  private spawnTimer: number = 0
  private coinSpawnTimer: number = 0

  // Sistema de skins
  private selectedSkinId: string = localStorage.getItem('neonRunnerSelectedSkin') || 'default'
  private skins: Skin[] = [
    { id: 'default', name: 'Neon Cyan', color: '#00f5ff', glow: 'rgba(0, 245, 255, 0.5)', price: 0, unlocked: true },
    { id: 'magenta', name: 'Magenta', color: '#ff00ff', glow: 'rgba(255, 0, 255, 0.5)', price: 100, unlocked: false },
    { id: 'lime', name: 'Lime', color: '#00ff88', glow: 'rgba(0, 255, 136, 0.5)', price: 150, unlocked: false },
    { id: 'gold', name: 'Gold', color: '#ffd700', glow: 'rgba(255, 215, 0, 0.5)', price: 200, unlocked: false },
    { id: 'fire', name: 'Fire', color: '#ff6600', glow: 'rgba(255, 102, 0, 0.5)', price: 300, unlocked: false },
    { id: 'rainbow', name: 'Rainbow', color: 'rainbow', glow: 'rgba(255, 255, 255, 0.5)', price: 500, unlocked: false },
  ]

  private readonly PLAYER_WIDTH = 50
  private readonly PLAYER_HEIGHT = 60
  private readonly DUCK_HEIGHT = 35

  // Colores neón vibrantes
  private readonly COLORS = {
    player: '#00f5ff',
    playerGlow: 'rgba(0, 245, 255, 0.5)',
    obstacle: '#ff3366',
    obstacleGlow: 'rgba(255, 51, 102, 0.5)',
    ground: '#ff00ff',
    groundGlow: 'rgba(255, 0, 255, 0.3)',
    coin: '#ffd700',
    coinGlow: 'rgba(255, 215, 0, 0.6)',
    particle: ['#00f5ff', '#ff00ff', '#00ff88', '#ffff00', '#ff6600'],
    sky: ['#1a1a2e', '#16213e']
  }

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement
    this.ctx = this.canvas.getContext('2d')!
    this.setupCanvas()
    this.groundY = this.canvas.height - 80
    this.player = this.createPlayer()
    this.loadSkinData()
    this.updateUI()
    this.setupEventListeners()
    this.showMainMenu()
    this.menuLoop()
  }

  private loadSkinData(): void {
    // Cargar skins desbloqueadas
    const unlockedSkins = JSON.parse(localStorage.getItem('neonRunnerUnlockedSkins') || '["default"]')
    this.skins.forEach(skin => {
      if (unlockedSkins.includes(skin.id)) {
        skin.unlocked = true
      }
    })
    this.updatePlayerColors()
  }

  private saveSkinData(): void {
    const unlockedIds = this.skins.filter(s => s.unlocked).map(s => s.id)
    localStorage.setItem('neonRunnerUnlockedSkins', JSON.stringify(unlockedIds))
    localStorage.setItem('neonRunnerSelectedSkin', this.selectedSkinId)
  }

  private updatePlayerColors(): void {
    const skin = this.skins.find(s => s.id === this.selectedSkinId) || this.skins[0]
    this.COLORS.player = skin.color
    this.COLORS.playerGlow = skin.glow
  }

  private setupCanvas(): void {
    this.canvas.width = 800
    this.canvas.height = 400
  }

  private createPlayer(): Player {
    return {
      x: 80,
      y: this.groundY - this.PLAYER_HEIGHT,
      width: this.PLAYER_WIDTH,
      height: this.PLAYER_HEIGHT,
      velocityY: 0,
      isJumping: false,
      isDucking: false,
      runFrame: 0,
      jumpHeld: false
    }
  }

  private setupEventListeners(): void {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        if (this.inMenu && !this.inSkinMenu) {
          this.startGame()
        } else if (this.inSkinMenu) {
          // Nada, se maneja en skin menu
        } else if (!this.isGameOver) {
          if (!this.player.isJumping) {
            this.jump()
          }
          this.player.jumpHeld = true
        } else {
          this.restart()
        }
      }
      if ((e.code === 'ArrowDown' || e.code === 'KeyS') && !this.isGameOver && this.isStarted) {
        e.preventDefault()
        this.duck(true)
      }
      if (e.code === 'Escape' && this.isStarted && !this.isGameOver) {
        this.togglePause()
      }
    })

    document.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.duck(false)
      }
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        this.player.jumpHeld = false
        this.jumpHoldFrames = 0
      }
    })

    // Touch controls
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault()
      if (this.inMenu && !this.inSkinMenu) {
        this.startGame()
      } else if (!this.isGameOver && this.isStarted) {
        this.jump()
      }
    })

    // Botones del menú
    document.getElementById('playBtn')?.addEventListener('click', () => this.startGame())
    document.getElementById('skinsBtn')?.addEventListener('click', () => this.showSkinMenu())
    document.getElementById('backBtn')?.addEventListener('click', () => this.hideSkinMenu())
    document.getElementById('restartBtn')?.addEventListener('click', () => this.restart())
  }

  private showMainMenu(): void {
    this.inMenu = true
    this.inSkinMenu = false
    document.getElementById('mainMenu')?.classList.remove('hidden')
    document.getElementById('skinMenu')?.classList.add('hidden')
    document.getElementById('gameOverlay')?.classList.remove('active')
    document.getElementById('startScreen')?.classList.add('hidden')
    this.updateUI()
  }

  private showSkinMenu(): void {
    this.inSkinMenu = true
    document.getElementById('mainMenu')?.classList.add('hidden')
    document.getElementById('skinMenu')?.classList.remove('hidden')
    this.renderSkinMenu()
  }

  private hideSkinMenu(): void {
    this.inSkinMenu = false
    document.getElementById('mainMenu')?.classList.remove('hidden')
    document.getElementById('skinMenu')?.classList.add('hidden')
  }

  private renderSkinMenu(): void {
    const container = document.getElementById('skinsContainer')
    const coinsEl = document.getElementById('skinMenuCoins')
    if (coinsEl) coinsEl.textContent = this.totalCoins.toString()
    if (!container) return

    container.innerHTML = ''

    this.skins.forEach(skin => {
      const isSelected = skin.id === this.selectedSkinId
      const canAfford = this.totalCoins >= skin.price

      const skinCard = document.createElement('div')
      skinCard.className = `skin-card ${isSelected ? 'selected' : ''} ${!skin.unlocked && !canAfford ? 'locked' : ''}`

      const colorStyle = skin.color === 'rainbow'
        ? 'background: linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3);'
        : `background: ${skin.color};`

      skinCard.innerHTML = `
        <div class="skin-preview" style="${colorStyle}"></div>
        <div class="skin-info">
          <span class="skin-name">${skin.name}</span>
          ${!skin.unlocked ? `<span class="skin-price">${skin.price} coins</span>` : ''}
          ${isSelected ? '<span class="skin-equipped">EQUIPPED</span>' : ''}
        </div>
      `

      skinCard.addEventListener('click', () => {
        if (skin.unlocked) {
          this.selectSkin(skin.id)
        } else if (canAfford) {
          this.unlockSkin(skin.id)
        }
      })

      container.appendChild(skinCard)
    })
  }

  private selectSkin(skinId: string): void {
    this.selectedSkinId = skinId
    this.saveSkinData()
    this.updatePlayerColors()
    this.renderSkinMenu()
  }

  private unlockSkin(skinId: string): void {
    const skin = this.skins.find(s => s.id === skinId)
    if (skin && this.totalCoins >= skin.price && !skin.unlocked) {
      skin.unlocked = true
      this.totalCoins -= skin.price
      localStorage.setItem('neonRunnerCoins', this.totalCoins.toString())
      this.selectedSkinId = skinId
      this.saveSkinData()
      this.updatePlayerColors()
      this.updateUI()
      this.renderSkinMenu()
    }
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused
    if (!this.isPaused) {
      this.gameLoop()
    }
  }

  private startGame(): void {
    this.inMenu = false
    this.inSkinMenu = false
    this.isStarted = true
    document.getElementById('mainMenu')?.classList.add('hidden')
    document.getElementById('skinMenu')?.classList.add('hidden')
    this.gameLoop()
  }

  private jump(): void {
    if (!this.player.isJumping && !this.player.isDucking) {
      this.player.velocityY = this.jumpForce
      this.player.isJumping = true
      this.jumpHoldFrames = 0
      this.createJumpParticles()
    }
  }

  private duck(active: boolean): void {
    if (!this.player.isJumping) {
      this.player.isDucking = active
      if (active) {
        this.player.height = this.DUCK_HEIGHT
        this.player.y = this.groundY - this.DUCK_HEIGHT
      } else {
        this.player.height = this.PLAYER_HEIGHT
        this.player.y = this.groundY - this.PLAYER_HEIGHT
      }
    }
  }

  private createJumpParticles(): void {
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: this.player.x + this.player.width / 2,
        y: this.player.y + this.player.height,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 3 + 1,
        life: 30,
        maxLife: 30,
        color: this.COLORS.particle[Math.floor(Math.random() * this.COLORS.particle.length)],
        size: Math.random() * 4 + 2
      })
    }
  }

  private createCoinParticles(coinX: number, coinY: number): void {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10
      this.particles.push({
        x: coinX,
        y: coinY,
        vx: Math.cos(angle) * 4,
        vy: Math.sin(angle) * 4,
        life: 25,
        maxLife: 25,
        color: '#ffd700',
        size: Math.random() * 4 + 2
      })
    }
  }

  private createRunParticles(): void {
    if (Math.random() < 0.3 && !this.player.isJumping) {
      this.particles.push({
        x: this.player.x,
        y: this.player.y + this.player.height,
        vx: -Math.random() * 3 - 2,
        vy: Math.random() * 2,
        life: 20,
        maxLife: 20,
        color: this.COLORS.particle[0],
        size: Math.random() * 3 + 1
      })
    }
  }

  private spawnObstacle(): void {
    const types: Obstacle['type'][] = ['cactus', 'bird', 'doubleCactus']
    const type = types[Math.floor(Math.random() * types.length)]

    let width: number, height: number
    let birdY: number | undefined

    switch (type) {
      case 'cactus':
        width = 30 + Math.random() * 20
        height = 50 + Math.random() * 30
        break
      case 'bird':
        width = 40
        height = 30
        // Dos alturas: bajo (hay que agacharse) o alto (hay que saltar)
        // Bajo: a altura de la cabeza del jugador de pie
        // Alto: por arriba del salto normal
        const birdHeights = [
          this.groundY - this.PLAYER_HEIGHT - 10, // Bajo - hay que agacharse SI O SI
          this.groundY - 140 // Alto - hay que saltar SI O SI
        ]
        birdY = birdHeights[Math.floor(Math.random() * birdHeights.length)]
        break
      case 'doubleCactus':
        width = 60
        height = 45
        break
      default:
        width = 35
        height = 55
    }

    this.obstacles.push({
      x: this.canvas.width,
      width,
      height,
      type,
      passed: false,
      birdY
    })
  }

  private spawnCoin(): void {
    // Evitar spawnear monedas muy cerca de obstáculos
    const hasNearObstacle = this.obstacles.some(o => o.x > this.canvas.width - 100)
    if (hasNearObstacle) return

    const yPositions = [
      this.groundY - 150, // Alto - hay que saltar
      this.groundY - 100, // Medio
      this.groundY - 50   // Bajo
    ]

    this.coins.push({
      x: this.canvas.width,
      y: yPositions[Math.floor(Math.random() * yPositions.length)],
      radius: 15,
      rotation: 0,
      collected: false
    })
  }

  private updatePlayer(): void {
    // Salto variable: mantener tecla = salto más alto
    if (this.player.isJumping && this.player.jumpHeld && this.jumpHoldFrames < this.jumpHoldMaxFrames) {
      this.player.velocityY += this.jumpHoldBoost
      this.jumpHoldFrames++
    }

    this.player.velocityY += this.gravity
    this.player.y += this.player.velocityY

    const groundLimit = this.groundY - this.player.height
    if (this.player.y >= groundLimit) {
      this.player.y = groundLimit
      this.player.velocityY = 0
      this.player.isJumping = false
      this.jumpHoldFrames = 0
    }

    this.runAnimationTimer++
    if (this.runAnimationTimer >= 6) {
      this.runAnimationTimer = 0
      this.player.runFrame = (this.player.runFrame + 1) % 2
    }

    this.createRunParticles()
  }

  private updateObstacles(): void {
    this.spawnTimer++

    // Spawn rate: empieza lento y se acelera gradualmente
    const spawnRate = Math.max(80, 140 - Math.floor(this.score / 100) * 5)
    if (this.spawnTimer >= spawnRate && this.obstacles.length < 4) {
      this.spawnTimer = 0
      this.spawnObstacle()
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i]
      obs.x -= this.gameSpeed

      if (!obs.passed && obs.x + obs.width < this.player.x) {
        obs.passed = true
        this.score += 10
        this.updateUI()
      }

      if (obs.x + obs.width < 0) {
        this.obstacles.splice(i, 1)
      }
    }
  }

  private updateCoins(): void {
    this.coinSpawnTimer++

    // Spawn de monedas cada ~3-4 segundos
    const coinRate = Math.max(150, 200 - Math.floor(this.score / 200) * 10)
    if (this.coinSpawnTimer >= coinRate && this.coins.length < 3) {
      this.coinSpawnTimer = 0
      if (Math.random() < 0.6) {
        this.spawnCoin()
      }
    }

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i]
      coin.x -= this.gameSpeed
      coin.rotation += 0.1

      // Detectar colisión con moneda
      const playerCenterX = this.player.x + this.player.width / 2
      const playerCenterY = this.player.y + this.player.height / 2
      const dist = Math.sqrt((playerCenterX - coin.x) ** 2 + (playerCenterY - coin.y) ** 2)

      if (dist < coin.radius + 25) {
        coin.collected = true
        this.score += 10
        this.totalCoins += 1
        localStorage.setItem('neonRunnerCoins', this.totalCoins.toString())
        this.createCoinParticles(coin.x, coin.y)
        this.updateUI()
      }

      if (coin.x + coin.radius < 0 || coin.collected) {
        this.coins.splice(i, 1)
      }
    }
  }

  private updateParticles(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx
      p.y += p.vy
      p.life--

      if (p.life <= 0) {
        this.particles.splice(i, 1)
      }
    }
  }

  private updateDifficulty(): void {
    // Dificultad gradual: aumenta cada 50 puntos
    const targetSpeed = this.baseSpeed + Math.floor(this.score / 50) * 0.3
    this.gameSpeed = Math.min(targetSpeed, this.maxSpeed)
  }

  private checkCollision(): boolean {
    const playerBox = {
      x: this.player.x + 8,
      y: this.player.y + 8,
      width: this.player.width - 16,
      height: this.player.height - 16
    }

    for (const obs of this.obstacles) {
      let obsY = this.groundY - obs.height
      if (obs.type === 'bird' && obs.birdY !== undefined) {
        obsY = obs.birdY
      }

      const obsBox = {
        x: obs.x + 8,
        y: obsY + 8,
        width: obs.width - 16,
        height: obs.height - 16
      }

      if (
        playerBox.x < obsBox.x + obsBox.width &&
        playerBox.x + playerBox.width > obsBox.x &&
        playerBox.y < obsBox.y + obsBox.height &&
        playerBox.y + playerBox.height > obsBox.y
      ) {
        return true
      }
    }
    return false
  }

  private gameOver(): void {
    this.isGameOver = true
    if (this.score > this.highScore) {
      this.highScore = this.score
      localStorage.setItem('neonRunnerHighScore', this.highScore.toString())
    }
    this.updateUI()

    document.getElementById('finalScore')!.textContent = this.score.toString()
    const finalCoinsEl = document.getElementById('finalCoins')
    if (finalCoinsEl) finalCoinsEl.textContent = this.totalCoins.toString()
    document.getElementById('gameOverlay')?.classList.add('active')

    this.createExplosionParticles()
  }

  private createExplosionParticles(): void {
    for (let i = 0; i < 50; i++) {
      const angle = (Math.PI * 2 * i) / 50
      const speed = Math.random() * 10 + 5
      this.particles.push({
        x: this.player.x + this.player.width / 2,
        y: this.player.y + this.player.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 60,
        maxLife: 60,
        color: this.COLORS.particle[Math.floor(Math.random() * this.COLORS.particle.length)],
        size: Math.random() * 8 + 4
      })
    }
  }

  private restart(): void {
    this.score = 0
    this.gameSpeed = this.baseSpeed
    this.isGameOver = false
    this.obstacles = []
    this.particles = []
    this.coins = []
    this.player = this.createPlayer()
    this.spawnTimer = 0
    this.coinSpawnTimer = 0

    document.getElementById('gameOverlay')?.classList.remove('active')
    this.updateUI()
    this.gameLoop()
  }

  private updateUI(): void {
    document.getElementById('score')!.textContent = this.score.toString()
    document.getElementById('highScore')!.textContent = this.highScore.toString()
    const coinsDisplay = document.getElementById('coinsDisplay')
    if (coinsDisplay) coinsDisplay.textContent = this.totalCoins.toString()
    const menuCoins = document.getElementById('menuCoins')
    if (menuCoins) menuCoins.textContent = this.totalCoins.toString()
  }

  private drawBackground(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(1, '#16213e')
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    for (let i = 0; i < 50; i++) {
      const x = (i * 17 + this.groundOffset * 0.2) % this.canvas.width
      const y = (i * 23) % (this.groundY - 100)
      this.ctx.fillRect(x, y, 1, 1)
    }
  }

  private drawGround(): void {
    this.ctx.shadowColor = this.COLORS.groundGlow
    this.ctx.shadowBlur = 15
    this.ctx.strokeStyle = this.COLORS.ground
    this.ctx.lineWidth = 3
    this.ctx.beginPath()
    this.ctx.moveTo(0, this.groundY)
    this.ctx.lineTo(this.canvas.width, this.groundY)
    this.ctx.stroke()
    this.ctx.shadowBlur = 0

    if (this.isStarted && !this.isGameOver) {
      this.groundOffset = (this.groundOffset + this.gameSpeed) % 40
    }
    this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)'
    this.ctx.lineWidth = 1
    for (let x = -this.groundOffset; x < this.canvas.width; x += 40) {
      this.ctx.beginPath()
      this.ctx.moveTo(x, this.groundY + 5)
      this.ctx.lineTo(x + 20, this.groundY + 5)
      this.ctx.stroke()
    }
  }

  private drawPlayer(): void {
    const { x, y, width, height, runFrame, isDucking } = this.player

    const skin = this.skins.find(s => s.id === this.selectedSkinId) || this.skins[0]

    // Rainbow effect
    if (skin.color === 'rainbow') {
      const gradient = this.ctx.createLinearGradient(x, y, x + width, y + height)
      gradient.addColorStop(0, '#ff0000')
      gradient.addColorStop(0.17, '#ff7f00')
      gradient.addColorStop(0.33, '#ffff00')
      gradient.addColorStop(0.5, '#00ff00')
      gradient.addColorStop(0.67, '#0000ff')
      gradient.addColorStop(0.83, '#4b0082')
      gradient.addColorStop(1, '#9400d3')
      this.ctx.fillStyle = gradient
    } else {
      this.ctx.fillStyle = this.COLORS.player
    }

    this.ctx.shadowColor = this.COLORS.playerGlow
    this.ctx.shadowBlur = 20

    this.ctx.beginPath()
    if (isDucking) {
      this.ctx.roundRect(x, y, width, height, 10)
    } else {
      this.ctx.roundRect(x + 20, y, 25, 20, 5)
      this.ctx.roundRect(x + 5, y + 18, 40, 25, 5)
      this.ctx.moveTo(x, y + 30)
      this.ctx.lineTo(x + 5, y + 25)
      this.ctx.lineTo(x + 5, y + 40)
    }
    this.ctx.fill()

    if (!isDucking) {
      this.ctx.fillStyle = '#0a0a1e'
      this.ctx.beginPath()
      this.ctx.arc(x + 38, y + 8, 4, 0, Math.PI * 2)
      this.ctx.fill()
    }

    this.ctx.strokeStyle = skin.color === 'rainbow' ? '#ffffff' : this.COLORS.player
    this.ctx.lineWidth = 6
    this.ctx.lineCap = 'round'

    const legY = isDucking ? y + height : y + height - 5
    const legOffset = runFrame === 0 ? 10 : -10

    if (!isDucking) {
      this.ctx.beginPath()
      this.ctx.moveTo(x + 15, legY - 20)
      this.ctx.lineTo(x + 15 + legOffset, legY)
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.moveTo(x + 30, legY - 20)
      this.ctx.lineTo(x + 30 - legOffset, legY)
      this.ctx.stroke()
    }

    this.ctx.shadowBlur = 0
  }

  private drawObstacles(): void {
    for (const obs of this.obstacles) {
      const { x, width, height, type } = obs
      let y = this.groundY - height

      this.ctx.shadowColor = this.COLORS.obstacleGlow
      this.ctx.shadowBlur = 15
      this.ctx.fillStyle = this.COLORS.obstacle

      if (type === 'cactus') {
        this.ctx.beginPath()
        this.ctx.roundRect(x, y, width, height, 5)
        this.ctx.fill()

        this.ctx.strokeStyle = 'rgba(255, 51, 102, 0.5)'
        this.ctx.lineWidth = 2
        this.ctx.beginPath()
        this.ctx.moveTo(x + width / 2, y)
        this.ctx.lineTo(x + width / 2, y + height)
        this.ctx.stroke()
      } else if (type === 'bird') {
        // Usar altura personalizada del pájaro
        y = obs.birdY !== undefined ? obs.birdY : this.groundY - height - 60
        const wingOffset = Math.sin(Date.now() / 100) * 10
        this.ctx.beginPath()
        this.ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 3, 0, 0, Math.PI * 2)
        this.ctx.fill()
        this.ctx.beginPath()
        this.ctx.moveTo(x + 10, y + height / 2)
        this.ctx.lineTo(x, y + wingOffset - 5)
        this.ctx.lineTo(x + 15, y + height / 2)
        this.ctx.fill()
        this.ctx.beginPath()
        this.ctx.moveTo(x + width - 10, y + height / 2)
        this.ctx.lineTo(x + width, y + wingOffset - 5)
        this.ctx.lineTo(x + width - 15, y + height / 2)
        this.ctx.fill()
      } else if (type === 'doubleCactus') {
        this.ctx.beginPath()
        this.ctx.roundRect(x, y + 10, width / 2 - 5, height - 10, 5)
        this.ctx.roundRect(x + width / 2 + 5, y, width / 2 - 5, height, 5)
        this.ctx.fill()
      }

      this.ctx.shadowBlur = 0
    }
  }

  private drawCoins(): void {
    for (const coin of this.coins) {
      this.ctx.save()
      this.ctx.translate(coin.x, coin.y)

      // Efecto de brillo
      this.ctx.shadowColor = this.COLORS.coinGlow
      this.ctx.shadowBlur = 20

      // Moneda con animación de rotación (efecto 3D)
      const scale = Math.abs(Math.cos(coin.rotation))
      this.ctx.fillStyle = this.COLORS.coin
      this.ctx.beginPath()
      this.ctx.ellipse(0, 0, coin.radius * Math.max(0.3, scale), coin.radius, 0, 0, Math.PI * 2)
      this.ctx.fill()

      // Brillo interno
      if (scale > 0.5) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        this.ctx.beginPath()
        this.ctx.ellipse(-3, -3, 4, 4, 0, 0, Math.PI * 2)
        this.ctx.fill()
      }

      this.ctx.restore()
    }
    this.ctx.shadowBlur = 0
  }

  private drawParticles(): void {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife
      this.ctx.globalAlpha = alpha
      this.ctx.fillStyle = p.color
      this.ctx.shadowColor = p.color
      this.ctx.shadowBlur = 10
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
      this.ctx.fill()
    }
    this.ctx.globalAlpha = 1
    this.ctx.shadowBlur = 0
  }

  private draw(): void {
    this.drawBackground()
    this.drawGround()
    this.drawParticles()
    this.drawCoins()
    this.drawObstacles()
    if (!this.isGameOver) {
      this.drawPlayer()
    }
  }

  private menuLoop = (): void => {
    if (this.isStarted || this.isGameOver) return

    this.drawBackground()
    this.drawGround()

    // Animación del suelo en el menú
    this.groundOffset = (this.groundOffset + 2) % 40

    requestAnimationFrame(this.menuLoop)
  }

  private gameLoop = (): void => {
    if (this.isPaused) return

    if (this.isGameOver) {
      this.updateParticles()
      this.draw()
      if (this.particles.length > 0) {
        requestAnimationFrame(this.gameLoop)
      } else {
        this.showMainMenu()
      }
      return
    }

    this.updatePlayer()
    this.updateObstacles()
    this.updateCoins()
    this.updateParticles()
    this.updateDifficulty()

    if (this.checkCollision()) {
      this.gameOver()
      this.draw()
      return
    }

    this.draw()
    requestAnimationFrame(this.gameLoop)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new NeonRunner()
})
