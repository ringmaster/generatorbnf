// Browser entry point for the Text Generator BNF Library
import { Generator, WeightedItem } from './generator';

// Export the library to the global scope for browser usage
if (typeof window !== 'undefined') {
  window.GeneratorBNF = {
    Generator,
    WeightedItem
  };
}

// Example grammars
const examples = {
  basic: {
    grammar: `$start := Hello $name! You have $$.hp health points.
$name := Alice | Bob | Charlie | Dana`,
    knowledge: `{
  "hp": 100,
  "level": 5
}`
  },
  
  rpg: {
    grammar: `$start := [!$$.day += 1] Day $$.day: $event
$event := [$$.hp < 20 ? $emergency | $normal]
$emergency := [!$$.hp += 15] Emergency healing! HP: $$.hp
$normal := You $activity and $outcome.
$activity := explore the dungeon | fight monsters | rest at camp
$outcome := find treasure | get injured | make progress`,
    knowledge: `{
  "day": 0,
  "hp": 15,
  "gold": 100
}`
  },
  
  expressions: {
    grammar: `$start := [!$damage = $$.baseDamage * $multiplier] You deal [$damage] damage!
$multiplier := 1.0:5 | 1.5:3 | 2.0:1`,
    knowledge: `{
  "baseDamage": 10,
  "critChance": 0.2
}`
  },
  
  knowledge: {
    grammar: `$start := Status: $status | Action: $action
$status := [$$.player.hp > 80 ? Excellent | $$.player.hp > 50 ? Good | Critical]
$action := [$$.player.hp < 30 ? [!$$.player.hp += 20] You rest and recover | You continue exploring]`,
    knowledge: `{
  "player": {
    "hp": 25,
    "maxHp": 100,
    "energy": 80
  },
  "game": {
    "difficulty": "normal",
    "chapter": 3
  }
}`
  }
};

function loadExample(exampleName) {
  const example = examples[exampleName];
  if (example) {
    document.getElementById('grammar').value = example.grammar;
    document.getElementById('knowledge').value = example.knowledge;
  }
}

function generate(customSeed = null) {
  const grammarText = document.getElementById('grammar').value.trim();
  const knowledgeText = document.getElementById('knowledge').value.trim();
  const seedValue = customSeed !== null ? customSeed : parseInt(document.getElementById('seed').value) || 123;
  const outputDiv = document.getElementById('output');
  
  if (customSeed !== null) {
    document.getElementById('seed').value = customSeed;
  }
  
  try {
    // Clear previous state
    outputDiv.className = 'output';
    outputDiv.textContent = 'Generating...';
    
    // Parse knowledge
    let knowledge = {};
    if (knowledgeText) {
      try {
        knowledge = JSON.parse(knowledgeText);
      } catch (e) {
        throw new Error(`Invalid JSON in knowledge: ${e.message}`);
      }
    }
    
    // Generate using the library
    const generator = Generator.compile(grammarText);
    const result = generator.execute(knowledge, seedValue);
    
    // Display results
    let output = `Output: ${result.output}\n\n`;
    output += `Updated Knowledge:\n${JSON.stringify(result.updatedKnowledge, null, 2)}\n\n`;
    output += `Seed used: ${seedValue}`;
    
    outputDiv.textContent = output;
    
  } catch (error) {
    outputDiv.className = 'output error';
    handleError(error);
    console.error('Generation error:', error);
  }
}

function handleError(error) {
  const outputDiv = document.getElementById('output');
  outputDiv.className = 'output error';
  outputDiv.innerHTML = `
    <div class="build-instructions">
      <h3>⚠️ Error Occurred</h3>
      <p><strong>Error details:</strong><br>
      <span style="font-size: 12px; color: #666;">${error.message}</span></p>
    </div>
  `;
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Set up example buttons
  document.getElementById('basic-example').addEventListener('click', () => loadExample('basic'));
  document.getElementById('rpg-example').addEventListener('click', () => loadExample('rpg'));
  document.getElementById('expressions-example').addEventListener('click', () => loadExample('expressions'));
  document.getElementById('knowledge-example').addEventListener('click', () => loadExample('knowledge'));
  
  // Set up generate buttons
  document.getElementById('generateBtn').addEventListener('click', () => generate());
  document.getElementById('random-seed').addEventListener('click', () => generate(Math.floor(Math.random() * 999999)));
  
  // Allow Enter+Ctrl to generate
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
      generate();
    }
  });
  
  // Load example and generate on first load
  loadExample('basic');
  setTimeout(() => generate(), 100);
});

// Export for module usage
export { Generator, WeightedItem };