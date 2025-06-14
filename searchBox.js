// Main function to set up the typeahead
function setupTypeahead(items, inputId, resultsId) {
    const searchInput = document.getElementById(inputId);
    const resultsContainer = document.getElementById(resultsId);
    
    // Create search index
    const { wordIndex, prefixIndex } = createSearchIndices(items);
    
    // Setup event listeners
    let debounceTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      
      debounceTimer = setTimeout(() => {
        const query = this.value.trim();
        if (query.length < 2) {
          resultsContainer.innerHTML = '';
          return;
        }
        
        // Perform search with ranking
        const results = searchWithIndices(query, items, wordIndex, prefixIndex);
        displayResults(results, resultsContainer, query, searchInput);
      }, 250);
    });
  }
  
  // Create both word and prefix indices for more flexible searching
  function createSearchIndices(items) {
    const wordIndex = {};   // For full word matches
    const prefixIndex = {}; // For prefix matches
    
    items.forEach((item, idx) => {
      // Normalize the text
      const normalizedItem = item.toLowerCase();
      
      // Index full words
      const words = normalizedItem.split(/\W+/).filter(word => word.length > 1);
      words.forEach(word => {
        if (!wordIndex[word]) {
          wordIndex[word] = new Set();
        }
        wordIndex[word].add(idx);
        
        // Index all prefixes of the word (for partial matching)
        for (let i = 1; i <= word.length; i++) {
          const prefix = word.substring(0, i);
          if (!prefixIndex[prefix]) {
            prefixIndex[prefix] = new Set();
          }
          prefixIndex[prefix].add(idx);
        }
      });
    });
    
    return { wordIndex, prefixIndex };
  }
  
  // Search function with fuzzy matching and relevance ranking
  function searchWithIndices(query, items, wordIndex, prefixIndex) {
    // Split the query into words
    const queryWords = query.toLowerCase().split(/\W+/).filter(word => word.length > 0);
    
    // Track matches and their scores
    const scoreMap = new Map();
    
    queryWords.forEach(queryWord => {
      // 1. Try exact word matches (highest score)
      if (wordIndex[queryWord]) {
        wordIndex[queryWord].forEach(idx => {
          const currentScore = scoreMap.get(idx) || 0;
          scoreMap.set(idx, currentScore + 10); // Higher score for exact matches
        });
      }
      
      // 2. Try prefix matches (good score)
      if (prefixIndex[queryWord]) {
        prefixIndex[queryWord].forEach(idx => {
          const currentScore = scoreMap.get(idx) || 0;
          scoreMap.set(idx, currentScore + 5); // Medium score for prefix matches
        });
      }
      
      // 3. Try fuzzy matches (lower score)
      const fuzzyMatches = findFuzzyMatches(queryWord, Object.keys(wordIndex), 2);
      fuzzyMatches.forEach(match => {
        if (wordIndex[match]) {
          wordIndex[match].forEach(idx => {
            const currentScore = scoreMap.get(idx) || 0;
            scoreMap.set(idx, currentScore + 3); // Lower score for fuzzy matches
          });
        }
      });
      
      // 4. Check for substring matches anywhere in the item (lowest score)
      items.forEach((item, idx) => {
        if (item.toLowerCase().includes(queryWord)) {
          const currentScore = scoreMap.get(idx) || 0;
          scoreMap.set(idx, currentScore + 1); // Lowest score for substring matches
        }
      });
    });
    
    // Convert to array and sort by score
    const scoredResults = Array.from(scoreMap.entries())
      .map(([idx, score]) => ({ item: items[idx], score, idx }))
      .sort((a, b) => b.score - a.score) // Sort by score (descending)
      .slice(0, 10); // Limit to top 10 results
    
    return scoredResults;
  }
  
  // Levenshtein distance for fuzzy matching
  function levenshteinDistance(a, b) {
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i-1) === a.charAt(j-1)) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i-1][j-1] + 1, // substitution
            matrix[i][j-1] + 1,   // insertion
            matrix[i-1][j] + 1    // deletion
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }
  
  // Find fuzzy matches within a maximum edit distance
  function findFuzzyMatches(word, dictionary, maxDistance) {
    return dictionary.filter(dictWord => {
      // Quick length check as optimization
      if (Math.abs(word.length - dictWord.length) > maxDistance) {
        return false;
      }
      return levenshteinDistance(word, dictWord) <= maxDistance;
    });
  }
  
  // Display results with highlighting
  function displayResults(results, container, query, inputElement) {
    container.innerHTML = '';
    
    if (results.length === 0) {
      const noResults = document.createElement('div');
      noResults.textContent = 'No matches found';
      noResults.className = 'no-results';
      container.appendChild(noResults);
      return;
    }
    
    results.forEach(({ item, score }) => {
      const div = document.createElement('div');
      div.className = 'result-item';
      
      // Highlight matching parts
      const highlightedText = highlightMatches(item, query);
      div.innerHTML = highlightedText;
      
      // Add metadata about the match if desired
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'result-score';
      scoreSpan.textContent = `(Add Artist)`;
      div.appendChild(scoreSpan);
      
      // Handle result selection
      div.addEventListener('click', () => {
        inputElement.value = item;
        //container.innerHTML = '';
        
        // Trigger any needed actions when a selection is made
        const event = new Event('change', { bubbles: true });
        inputElement.dispatchEvent(event);
      });

      scoreSpan.addEventListener('click', () => {
        // Trigger any needed actions when a selection is made
        const event = new CustomEvent('addArtist', { bubbles: true, detail: {name: item.split(', ')[1]}});
        inputElement.dispatchEvent(event);
      });
      
      container.appendChild(div);
    });
  }
  
  // Highlight matching text
  function highlightMatches(text, query) {
    const queryWords = query.toLowerCase().split(/\W+/).filter(word => word.length > 0);
    let result = text;
    
    // queryWords.forEach(word => {
    //   // Use a case-insensitive regex to find matches
    //   const regex = new RegExp(`(${word})`, 'gi');
    //   result = result.replace(regex, '<strong>$1</strong>');
    // });
    
    return result;
  }

  // Main implementation with optimizations for large datasets
function createTypeaheadForLargeDataset(items, inputId, resultsId) {
    const searchInput = document.getElementById(inputId);
    const resultsContainer = document.getElementById(resultsId);
    
    // Create efficient indices
    console.time('Index creation');
    const { wordIndex, prefixIndex } = createOptimizedIndices(items);
    console.timeEnd('Index creation');
    
    // Cache the indices in sessionStorage or localStorage
    try {
      if (window.sessionStorage) {
        sessionStorage.setItem('typeahead_indices', JSON.stringify({
          wordIndex: serializeIndices(wordIndex),
          prefixIndex: serializeIndices(prefixIndex)
        }));
      }
    } catch (e) {
      console.warn('Could not cache indices:', e);
    }
    
    // Setup debounced search
    let debounceTimer;
    let lastQuery = '';
    
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      
      debounceTimer = setTimeout(() => {
        const query = this.value.trim();
        
        // Skip search if query is short or unchanged
        if (query.length < 2 || query === lastQuery) {
          if (query.length < 2) resultsContainer.innerHTML = '';
          return;
        }
        
        lastQuery = query;
        
        // Progressive search for better UX
        // First do a fast prefix search to show immediate results
        const quickResults = quickPrefixSearch(query, items, prefixIndex);
        displayResults(quickResults, resultsContainer, query, searchInput);
        
        // Then do the full fuzzy search (if query is complex enough)
        if (query.length >= 3 || quickResults.length < 3) {
          setTimeout(() => {
            if (query === lastQuery) { // Ensure query hasn't changed
              const fullResults = searchWithIndices(query, items, wordIndex, prefixIndex);
              displayResults(fullResults, resultsContainer, query, searchInput);
            }
          }, 50);
        }
      }, 200);
    });
  }
  
  // Optimized index creation for large datasets
  function createOptimizedIndices(items) {
    const wordIndex = {};
    const prefixIndex = {};
    
    // Precompute common words to exclude (optional)
    const stopWords = new Set(['the', 'and', 'of', 'to', 'a', 'in', 'for', 'is']);
    
    items.forEach((item, idx) => {
      const normalizedItem = item.toLowerCase();
      const words = normalizedItem.split(/\W+/).filter(word => 
        word.length > 1 && !stopWords.has(word)
      );
      
      words.forEach(word => {
        // Word index (full words)
        if (!wordIndex[word]) {
          wordIndex[word] = new Set();
        }
        wordIndex[word].add(idx);
        
        // Only index prefixes for words of reasonable length
        if (word.length <= 12) {  // Skip very long words
          // Prefix index (only meaningful prefixes)
          // For efficiency, we might not index all possible prefixes
          for (let i = 2; i <= Math.min(6, word.length); i++) {
            const prefix = word.substring(0, i);
            if (!prefixIndex[prefix]) {
              prefixIndex[prefix] = new Set();
            }
            prefixIndex[prefix].add(idx);
          }
        }
      });
    });
    
    return { wordIndex, prefixIndex };
  }
  
  // Quick prefix search for immediate feedback
  function quickPrefixSearch(query, items, prefixIndex) {
    const firstWord = query.toLowerCase().split(/\W+/)[0];
    const prefix = firstWord.substring(0, Math.min(4, firstWord.length));
    
    if (!prefixIndex[prefix]) return [];
    
    const matches = new Set();
    prefixIndex[prefix].forEach(idx => {
      // Simple filtering to ensure some relevance
      if (items[idx].toLowerCase().includes(firstWord)) {
        matches.add(idx);
      }
    });
    
    // Convert to array and limit
    return Array.from(matches)
      .map(idx => ({ item: items[idx], score: 1, idx }))
      .slice(0, 10);
  }
  
  // Helper to serialize indices for caching
  function serializeIndices(index) {
    const serialized = {};
    for (const key in index) {
      serialized[key] = Array.from(index[key]);
    }
    return serialized;
  }
  
  // Helper to deserialize cached indices
  function deserializeIndices(serialized) {
    const deserialized = {};
    for (const key in serialized) {
      deserialized[key] = new Set(serialized[key]);
    }
    return deserialized;
  }