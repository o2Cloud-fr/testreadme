const express = require('express');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = 3000;

// Configuration
let config = {
  repoPath: process.cwd(),
  commitMessages: [
    "📝 Update documentation",
    "🔧 Fix minor issues",
    "✨ Add new features",
    "🐛 Bug fixes",
    "🎨 Improve code structure",
    "⚡ Performance improvements",
    "🔒 Security updates",
    "📱 Mobile responsiveness",
    "🌐 Internationalization",
    "🚀 Deploy updates"
  ],
  isActive: false,
  lastCommit: null,
  commitCount: 0
};

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Fonction pour exécuter des commandes git
function executeGitCommand(command, repoPath) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: repoPath }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Fonction pour créer des changements fictifs
async function createDummyChanges(repoPath) {
  const changeTypes = [
    async () => {
      // Créer/modifier un fichier README
      const content = `# Projet Auto-Commit\n\nDernière mise à jour: ${new Date().toISOString()}\n\nCommit automatique #${config.commitCount + 1}`;
      await fs.writeFile(path.join(repoPath, 'README.md'), content);
    },
    async () => {
      // Créer un fichier de log
      const logContent = `${new Date().toISOString()} - Commit automatique\n`;
      await fs.appendFile(path.join(repoPath, 'auto-commit.log'), logContent);
    },
    async () => {
      // Créer un fichier de version
      const version = {
        version: `1.0.${config.commitCount + 1}`,
        timestamp: new Date().toISOString(),
        build: Math.floor(Math.random() * 1000)
      };
      await fs.writeFile(path.join(repoPath, 'version.json'), JSON.stringify(version, null, 2));
    }
  ];

  // Exécuter 1 ou 2 changements aléatoires
  const numChanges = Math.floor(Math.random() * 2) + 1;
  for (let i = 0; i < numChanges; i++) {
    const changeIndex = Math.floor(Math.random() * changeTypes.length);
    await changeTypes[changeIndex]();
  }
}

// Fonction pour faire un commit automatique
// Fonction pour faire un commit automatique (version corrigée)
async function performAutoCommit() {
  try {
    console.log('🔄 Début du commit automatique...');
    
    // Étape 1: Pull les derniers changements du remote
    try {
      console.log('📥 Récupération des derniers changements...');
      await executeGitCommand('git pull origin main', config.repoPath);
      console.log('✅ Changements récupérés avec succès');
    } catch (pullError) {
      console.log('⚠️ Avertissement lors du pull:', pullError.message);
      // Continue même si le pull échoue (peut-être pas de remote changes)
    }
    
    // Étape 2: Créer des changements
    await createDummyChanges(config.repoPath);
    
    // Étape 3: Ajouter les fichiers
    await executeGitCommand('git add .', config.repoPath);
    
    // Étape 4: Vérifier s'il y a des changements
    const { stdout } = await executeGitCommand('git status --porcelain', config.repoPath);
    
    if (!stdout.trim()) {
      console.log('⚠️ Aucun changement à commiter');
      return;
    }
    
    // Étape 5: Choisir un message de commit aléatoire
    const randomMessage = config.commitMessages[Math.floor(Math.random() * config.commitMessages.length)];
    const commitMessage = `${randomMessage} - ${new Date().toLocaleString()}`;
    
    // Étape 6: Faire le commit
    await executeGitCommand(`git commit -m "${commitMessage}"`, config.repoPath);
    console.log('✅ Commit local créé');
    
    // Étape 7: Push vers GitHub avec gestion des erreurs
    try {
      console.log('📤 Push vers GitHub...');
      await executeGitCommand('git push origin main', config.repoPath);
      console.log('✅ Push réussi');
    } catch (pushError) {
      console.log('⚠️ Première tentative de push échouée, essai avec upstream...');
      
      if (pushError.message.includes('no upstream branch')) {
        // Set upstream and push
        await executeGitCommand('git push --set-upstream origin main', config.repoPath);
        console.log('✅ Push avec upstream réussi');
      } else if (pushError.message.includes('non-fast-forward') || pushError.message.includes('rejected')) {
        // Le remote a des changements, on doit pull et retry
        console.log('🔄 Détection de changements distants, nouvelle tentative...');
        
        try {
          // Pull avec rebase pour éviter les merge commits
          await executeGitCommand('git pull --rebase origin main', config.repoPath);
          console.log('✅ Rebase réussi');
          
          // Retry push
          await executeGitCommand('git push origin main', config.repoPath);
          console.log('✅ Push après rebase réussi');
        } catch (rebaseError) {
          // Si le rebase échoue, on peut essayer un merge
          console.log('⚠️ Rebase échoué, tentative avec merge...');
          
          try {
            // Reset le rebase si nécessaire
            await executeGitCommand('git rebase --abort', config.repoPath).catch(() => {});
            
            // Pull normal (avec merge)
            await executeGitCommand('git pull origin main', config.repoPath);
            console.log('✅ Merge réussi');
            
            // Retry push
            await executeGitCommand('git push origin main', config.repoPath);
            console.log('✅ Push après merge réussi');
          } catch (finalError) {
            throw new Error(`Impossible de synchroniser: ${finalError.message}`);
          }
        }
      } else {
        throw pushError;
      }
    }
    
    // Étape 8: Mettre à jour les statistiques
    config.lastCommit = new Date().toISOString();
    config.commitCount++;
    
    console.log(`✅ Commit automatique réussi: ${commitMessage}`);
    
  } catch (error) {
    console.error('❌ Erreur lors du commit automatique:', error.message);
    
    // Log plus détaillé pour le debug
    console.error('📋 Détails de l\'erreur:', {
      message: error.message,
      code: error.code || 'N/A',
      signal: error.signal || 'N/A'
    });
  }
}
// Programmer les commits (toutes les heures avec variation aléatoire)
let cronJob = null;

function startAutomation() {
  if (cronJob) {
    cronJob.stop();
  }
  
  // Exécuter toutes les heures à une minute aléatoire
  cronJob = cron.schedule('0 * * * *', async () => {
    if (config.isActive) {
      // Ajouter une variation aléatoire de 0-30 minutes
      const delay = Math.floor(Math.random() * 30) * 60 * 1000;
      setTimeout(performAutoCommit, delay);
    }
  });
  
  console.log('⏰ Automation programmée: commits toutes les heures');
}

function stopAutomation() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  console.log('⏸️ Automation arrêtée');
}

// Routes API
app.get('/api/status', (req, res) => {
  res.json({
    isActive: config.isActive,
    lastCommit: config.lastCommit,
    commitCount: config.commitCount,
    repoPath: config.repoPath
  });
});

app.post('/api/start', (req, res) => {
  config.isActive = true;
  startAutomation();
  res.json({ success: true, message: 'Automation démarrée' });
});

app.post('/api/stop', (req, res) => {
  config.isActive = false;
  stopAutomation();
  res.json({ success: true, message: 'Automation arrêtée' });
});

app.post('/api/config', (req, res) => {
  const { repoPath, commitMessages } = req.body;
  
  if (repoPath) config.repoPath = repoPath;
  if (commitMessages) config.commitMessages = commitMessages;
  
  res.json({ success: true, config });
});

app.post('/api/manual-commit', async (req, res) => {
  try {
    await performAutoCommit();
    res.json({ success: true, message: 'Commit manuel réussi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route pour servir l'interface web
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auto Git Commit</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <div x-data="autoCommitApp()" class="container mx-auto px-4 py-8">
        <div class="max-w-4xl mx-auto">
            <!-- Header -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-800">🚀 Auto Git Commit</h1>
                        <p class="text-gray-600 mt-2">Automatisation des commits GitHub</p>
                    </div>
                    <div class="flex items-center space-x-4">
                        <div class="flex items-center">
                            <div :class="status.isActive ? 'bg-green-500' : 'bg-red-500'" 
                                 class="w-3 h-3 rounded-full mr-2"></div>
                            <span x-text="status.isActive ? 'Actif' : 'Inactif'" 
                                  class="font-semibold"></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="bg-white rounded-lg shadow-md p-6">
                    <div class="flex items-center">
                        <div class="p-3 rounded-full bg-blue-100 text-blue-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">Commits totaux</p>
                            <p class="text-2xl font-semibold text-gray-900" x-text="status.commitCount"></p>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow-md p-6">
                    <div class="flex items-center">
                        <div class="p-3 rounded-full bg-green-100 text-green-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">Dernier commit</p>
                            <p class="text-sm font-semibold text-gray-900" 
                               x-text="status.lastCommit ? new Date(status.lastCommit).toLocaleString() : 'Aucun'"></p>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow-md p-6">
                    <div class="flex items-center">
                        <div class="p-3 rounded-full bg-purple-100 text-purple-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">Statut</p>
                            <p class="text-sm font-semibold" 
                               :class="status.isActive ? 'text-green-600' : 'text-red-600'"
                               x-text="status.isActive ? 'En cours' : 'Arrêté'"></p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Controls -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 class="text-xl font-semibold text-gray-800 mb-4">Contrôles</h2>
                <div class="flex flex-wrap gap-4">
                    <button @click="toggleAutomation()" 
                            :class="status.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'"
                            class="px-6 py-2 text-white rounded-lg font-semibold transition-colors">
                        <span x-text="status.isActive ? '⏸️ Arrêter' : '▶️ Démarrer'"></span>
                    </button>
                    
                    <button @click="manualCommit()" 
                            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
                        🔄 Commit manuel
                    </button>
                    
                    <button @click="refreshStatus()" 
                            class="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors">
                        🔄 Actualiser
                    </button>
                </div>
            </div>

            <!-- Configuration -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold text-gray-800 mb-4">Configuration</h2>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Chemin du repository
                    </label>
                    <input type="text" x-model="config.repoPath" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Messages de commit (un par ligne)
                    </label>
                    <textarea x-model="commitMessagesText" rows="6"
                              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
                </div>

                <button @click="saveConfig()" 
                        class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors">
                    💾 Sauvegarder la configuration
                </button>
            </div>

            <!-- Messages -->
            <div x-show="message" x-transition 
                 :class="messageType === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'"
                 class="fixed top-4 right-4 px-4 py-3 border-l-4 rounded shadow-lg">
                <p x-text="message"></p>
            </div>
        </div>
    </div>

    <script>
        function autoCommitApp() {
            return {
                status: {
                    isActive: false,
                    lastCommit: null,
                    commitCount: 0,
                    repoPath: ''
                },
                config: {
                    repoPath: ''
                },
                commitMessagesText: '',
                message: '',
                messageType: 'success',

                async init() {
                    await this.refreshStatus();
                    // Auto-refresh toutes les 30 secondes
                    setInterval(() => this.refreshStatus(), 30000);
                },

                async refreshStatus() {
                    try {
                        const response = await fetch('/api/status');
                        this.status = await response.json();
                        this.config.repoPath = this.status.repoPath;
                    } catch (error) {
                        this.showMessage('Erreur lors de la récupération du statut', 'error');
                    }
                },

                async toggleAutomation() {
                    try {
                        const endpoint = this.status.isActive ? '/api/stop' : '/api/start';
                        const response = await fetch(endpoint, { method: 'POST' });
                        const result = await response.json();
                        
                        if (result.success) {
                            this.showMessage(result.message, 'success');
                            await this.refreshStatus();
                        }
                    } catch (error) {
                        this.showMessage('Erreur lors du changement d\\'état', 'error');
                    }
                },

                async manualCommit() {
                    try {
                        const response = await fetch('/api/manual-commit', { method: 'POST' });
                        const result = await response.json();
                        
                        if (result.success) {
                            this.showMessage(result.message, 'success');
                            await this.refreshStatus();
                        } else {
                            this.showMessage(result.error, 'error');
                        }
                    } catch (error) {
                        this.showMessage('Erreur lors du commit manuel', 'error');
                    }
                },

                async saveConfig() {
                    try {
                        const commitMessages = this.commitMessagesText.split('\\n').filter(msg => msg.trim());
                        
                        const response = await fetch('/api/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                repoPath: this.config.repoPath,
                                commitMessages: commitMessages
                            })
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            this.showMessage('Configuration sauvegardée', 'success');
                        }
                    } catch (error) {
                        this.showMessage('Erreur lors de la sauvegarde', 'error');
                    }
                },

                showMessage(msg, type = 'success') {
                    this.message = msg;
                    this.messageType = type;
                    setTimeout(() => { this.message = ''; }, 5000);
                }
            }
        }
    </script>
</body>
</html>
  `);
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🌟 Serveur démarré sur http://localhost:${PORT}`);
  console.log('📁 Interface web disponible à l\'adresse ci-dessus');
});

// Initialiser l'automation au démarrage si nécessaire
startAutomation();