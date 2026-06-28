class DantzigService {
  constructor() {
    this.INF = Number.POSITIVE_INFINITY;
  }

  executeDantzig(graph, sourceNode = null, mode = 'min') {
    const nodeIds = Array.isArray(graph.nodes) ? graph.nodes : [];

    const nodes = nodeIds.map(id =>
      typeof id === 'string' ? { id } : id
    );

    const source = sourceNode || nodes[0]?.id;

    if (!source) {
      throw new Error('Le nœud source est invalide');
    }

    if (mode === 'max') {
      return this.executeLongestPath(graph, nodes, source);
    }

    return this.executeShortestPath(graph, nodes, source);
  }

  // =====================================================
  // MINIMISATION (version proche de ton code actuel)
  // =====================================================

  executeShortestPath(graph, nodes, source) {
    const adjacencyList = {};

    nodes.forEach(node => {
      adjacencyList[node.id] = [];
    });

    graph.edges.forEach(edge => {
      adjacencyList[edge.from].push({
        to: edge.to,
        weight: edge.weight
      });
    });

    const lambdas = {};
    const predecessors = {};
    const markedNodes = [];
    const steps = [];

    nodes.forEach(node => {
      lambdas[node.id] = this.INF;
      predecessors[node.id] = null;
    });

    lambdas[source] = 0;

    steps.push({
      iteration: 0,
      description: 'Initialisation',
      lambdas: { ...lambdas },
      markedNodes: [],
      explanation: `λ_${source} = 0`
    });

    while (markedNodes.length < nodes.length) {
      let current = null;
      let minLambda = this.INF;

      nodes.forEach(node => {
        if (
          !markedNodes.includes(node.id) &&
          lambdas[node.id] < minLambda
        ) {
          minLambda = lambdas[node.id];
          current = node.id;
        }
      });

      if (!current) break;

      markedNodes.push(current);

      adjacencyList[current].forEach(edge => {
        const candidate =
          lambdas[current] + edge.weight;

        if (candidate < lambdas[edge.to]) {
          lambdas[edge.to] = candidate;
          predecessors[edge.to] = current;
        }
      });

      steps.push({
        iteration: steps.length,
        description: `Étape ${steps.length}`,
        currentNode: current,
        lambdas: { ...lambdas },
        markedNodes: [...markedNodes]
      });
    }

    const targetNode =
      this.findSink(nodes, graph.edges) ||
      markedNodes[markedNodes.length - 1];

    return {
      initialLambdas: steps[0].lambdas,
      steps,
      finalLambdas: lambdas,
      markedNodes,
      predecessors,
      optimalPaths: this.reconstructPaths(
        predecessors,
        source,
        nodes
      ),
      optimalPath: this.reconstructSinglePath(
        predecessors,
        source,
        targetNode
      ),
      optimalValue: lambdas[targetNode],
      sourceNode: source,
      targetNode,
      nodes
    };
  }

  // =====================================================
  // MAXIMISATION (plus long chemin dans un DAG, via tri topologique)
  // =====================================================
  //
  // Important : on ne fait PAS un DFS exhaustif avec retour-arrière
  // (qui explorait tous les chemins et désengageait les nœuds visités,
  // d'où des étapes interminables et des markedNodes incohérents).
  //
  // Sur un DAG, le plus long chemin depuis "source" se calcule par
  // relaxation, en traitant les nœuds dans l'ORDRE TOPOLOGIQUE : quand
  // on traite un nœud, tous ses prédécesseurs accessibles depuis la
  // source ont déjà été traités, donc sa valeur λ est définitive.
  // Cela garantit un marquage strictement croissant (1 étape / nœud),
  // exactement comme la version min, et compatible avec la
  // reconstruction des "tours k" côté StepsPanel.

  executeLongestPath(graph, nodes, source) {
    const adjacencyList = {};

    nodes.forEach(node => {
      adjacencyList[node.id] = [];
    });

    graph.edges.forEach(edge => {
      adjacencyList[edge.from].push({
        to: edge.to,
        weight: edge.weight
      });
    });

    // Lève une erreur si le graphe contient un cycle (le mode MAX exige un DAG).
    const order = this.topologicalSort(nodes, graph.edges);

    const lambdas = {};
    const predecessors = {};
    const markedNodes = [];
    const steps = [];

    nodes.forEach(node => {
      lambdas[node.id] = Number.NEGATIVE_INFINITY;
      predecessors[node.id] = null;
    });

    lambdas[source] = 0;

    steps.push({
      iteration: 0,
      description: 'Initialisation',
      lambdas: { ...lambdas },
      markedNodes: [],
      explanation: `λ_${source} = 0`
    });

    // On ne parcourt que la portion de l'ordre topologique à partir de la
    // source : les nœuds avant elle ne lui sont jamais accessibles.
    const sourceIndex = order.indexOf(source);
    const relevantOrder = order.slice(sourceIndex === -1 ? 0 : sourceIndex);

    relevantOrder.forEach(current => {
      // Un nœud non accessible depuis la source (λ encore -∞) n'est jamais marqué.
      if (lambdas[current] === Number.NEGATIVE_INFINITY) return;

      markedNodes.push(current);

      adjacencyList[current].forEach(edge => {
        const candidate = lambdas[current] + edge.weight;

        if (candidate > lambdas[edge.to]) {
          lambdas[edge.to] = candidate;
          predecessors[edge.to] = current;
        }
      });

      steps.push({
        iteration: steps.length,
        description: `Étape ${steps.length}`,
        currentNode: current,
        lambdas: { ...lambdas },
        markedNodes: [...markedNodes]
      });
    });

    const targetNode =
      this.findSink(nodes, graph.edges) ||
      markedNodes[markedNodes.length - 1];

    return {
      initialLambdas: steps[0].lambdas,
      steps,
      finalLambdas: { ...lambdas },
      markedNodes,
      predecessors,
      optimalPaths: this.reconstructPaths(
        predecessors,
        source,
        nodes
      ),
      optimalPath: this.reconstructSinglePath(
        predecessors,
        source,
        targetNode
      ),
      optimalValue: lambdas[targetNode],
      sourceNode: source,
      targetNode,
      nodes
    };
  }

  // =====================================================
  // TRI TOPOLOGIQUE
  // =====================================================

  topologicalSort(nodes, edges) {
    const indegree = {};
    const adjacency = {};

    nodes.forEach(node => {
      indegree[node.id] = 0;
      adjacency[node.id] = [];
    });

    edges.forEach(edge => {
      adjacency[edge.from].push(edge.to);
      indegree[edge.to]++;
    });

    const queue = [];

    Object.keys(indegree).forEach(node => {
      if (indegree[node] === 0) {
        queue.push(node);
      }
    });

    const order = [];

    while (queue.length) {
      const node = queue.shift();

      order.push(node);

      adjacency[node].forEach(next => {
        indegree[next]--;

        if (indegree[next] === 0) {
          queue.push(next);
        }
      });
    }

    if (order.length !== nodes.length) {
      throw new Error(
        'Le mode MAX nécessite un graphe sans cycle (DAG)'
      );
    }

    return order;
  }

  // =====================================================
  // UTILITAIRES
  // =====================================================

  findSink(nodes, edges) {
    const sinkIds = new Set(
      nodes.map(n => n.id)
    );

    edges.forEach(edge => {
      sinkIds.delete(edge.from);
    });

    return (
      nodes.find(n => sinkIds.has(n.id))?.id ||
      null
    );
  }

  reconstructPaths(predecessors, source, nodes) {
    const paths = [];

    nodes.forEach(node => {
      if (node.id === source) return;

      const path = [];
      let current = node.id;

      while (current !== null) {
        path.unshift(current);
        current = predecessors[current];
      }

      if (path[0] === source) {
        paths.push({
          from: source,
          to: node.id,
          path
        });
      }
    });

    return paths;
  }

  reconstructSinglePath(
    predecessors,
    source,
    target
  ) {
    const path = [];

    let current = target;

    while (current !== null) {
      path.unshift(current);
      current = predecessors[current];
    }

    if (path[0] !== source) {
      return null;
    }

    return {
      from: source,
      to: target,
      path
    };
  }
}

module.exports = new DantzigService();