const { minsToTimeStr } = require('./routesLoader');

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const boundedA = Math.min(1, Math.max(0, a));

  const c = 2 * Math.atan2(
    Math.sqrt(boundedA),
    Math.sqrt(1 - boundedA)
  );

  return Math.round(R * c);
}

function findNearbyStops(
  lat,
  lng,
  stopsMap,
  maxDistMeters = 1500
) {
  const nearby = [];

  for (const [id, stop] of stopsMap.entries()) {
    const distanceMeters = calculateDistanceMeters(
      lat,
      lng,
      stop.lat,
      stop.lng
    );

    if (distanceMeters <= maxDistMeters) {
      nearby.push({
        ...stop,
        distanceMeters,
        walkTimeMins: Math.max(
          1,
          Math.ceil(distanceMeters / 80)
        )
      });
    }
  }

  return nearby.sort(
    (a, b) =>
      a.distanceMeters - b.distanceMeters
  );
}

function buildConnections(routes) {
  const connections = [];

  for (const route of routes) {
    if (!route.stops || route.stops.length < 2) {
      continue;
    }

    for (let i = 0; i < route.stops.length - 1; i++) {
      const depStop = route.stops[i];
      const arrStop = route.stops[i + 1];

      connections.push({
        depStopId: depStop.id,
        arrStopId: arrStop.id,
        duration: 3,
        routeId: route.id,
        routeName: route.name,
        routeColor: route.color || '#ff8300',
        route,
        fromIndex: i,
        toIndex: i + 1
      });
    }
  }

  return connections;
}

function buildTransitAdjacency(connections) {
  const adjacency = new Map();

  for (const connection of connections) {
    if (!adjacency.has(connection.depStopId)) {
      adjacency.set(connection.depStopId, []);
    }

    adjacency.get(connection.depStopId).push({
      type: 'TRANSIT',
      toStopId: connection.arrStopId,
      duration: connection.duration,
      routeId: connection.routeId,
      routeName: connection.routeName,
      routeColor: connection.routeColor,
      route: connection.route,
      fromIndex: connection.fromIndex,
      toIndex: connection.toIndex
    });
  }

  return adjacency;
}

function buildWalkingAdjacency(
  stopsMap,
  maxTransferDistanceMeters = 300
) {
  const adjacency = new Map();
  const stops = Array.from(stopsMap.values());

  for (let i = 0; i < stops.length; i++) {
    const fromStop = stops[i];

    if (!adjacency.has(fromStop.id)) {
      adjacency.set(fromStop.id, []);
    }

    for (let j = 0; j < stops.length; j++) {
      if (i === j) {
        continue;
      }

      const toStop = stops[j];

      const distanceMeters =
        calculateDistanceMeters(
          fromStop.lat,
          fromStop.lng,
          toStop.lat,
          toStop.lng
        );

      if (
        distanceMeters <=
        maxTransferDistanceMeters
      ) {
        adjacency.get(fromStop.id).push({
          type: 'WALK',
          toStopId: toStop.id,
          duration: Math.max(
            1,
            Math.ceil(distanceMeters / 80)
          ),
          distanceMeters
        });
      }
    }
  }

  return adjacency;
}

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) {
      return null;
    }

    if (this.items.length === 1) {
      return this.items.pop();
    }

    const root = this.items[0];
    this.items[0] = this.items.pop();
    this.bubbleDown(0);

    return root;
  }

  bubbleUp(index) {
    let current = index;

    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);

      if (
        this.items[parent].cost <=
        this.items[current].cost
      ) {
        break;
      }

      [this.items[parent], this.items[current]] =
        [this.items[current], this.items[parent]];

      current = parent;
    }
  }

  bubbleDown(index) {
    let current = index;

    while (true) {
      const left = current * 2 + 1;
      const right = current * 2 + 2;
      let smallest = current;

      if (
        left < this.items.length &&
        this.items[left].cost <
          this.items[smallest].cost
      ) {
        smallest = left;
      }

      if (
        right < this.items.length &&
        this.items[right].cost <
          this.items[smallest].cost
      ) {
        smallest = right;
      }

      if (smallest === current) {
        break;
      }

      [this.items[current], this.items[smallest]] =
        [this.items[smallest], this.items[current]];

      current = smallest;
    }
  }

  get size() {
    return this.items.length;
  }
}

function reconstructPath(
  predecessor,
  destinationStopId
) {
  const steps = [];
  const visited = new Set();

  let currentStopId = destinationStopId;

  while (currentStopId) {
    if (visited.has(currentStopId)) {
      break;
    }

    visited.add(currentStopId);

    const step = predecessor.get(currentStopId);

    if (!step) {
      break;
    }

    steps.unshift(step);

    if (step.type === 'ORIGIN_WALK') {
      break;
    }

    currentStopId = step.fromStopId;
  }

  return steps;
}

function mergeTransitSteps(steps) {
  const merged = [];

  for (const step of steps) {
    if (step.type !== 'TRANSIT') {
      merged.push(step);
      continue;
    }

    const previous = merged[merged.length - 1];

    if (
      previous &&
      previous.type === 'TRANSIT' &&
      previous.routeId === step.routeId &&
      previous.toStopId === step.fromStopId
    ) {
      previous.toStopId = step.toStopId;
      previous.duration += step.duration;
      previous.toIndex = step.toIndex;
    } else {
      merged.push({
        ...step
      });
    }
  }

  return merged;
}

function runCSA({
  origin,
  destination,
  routes,
  stopsMap
}) {
  console.log('CSA NETWORK ROUTING IS RUNNING');

  const originStops =
    findNearbyStops(
      origin.lat,
      origin.lng,
      stopsMap,
      1500
    );

  const destinationStops =
    findNearbyStops(
      destination.lat,
      destination.lng,
      stopsMap,
      1500
    );

  if (
    originStops.length === 0 ||
    destinationStops.length === 0
  ) {
    return {
      options: []
    };
  }

  const destinationMap =
    new Map(
      destinationStops.map(stop => [
        stop.id,
        stop
      ])
    );

  const connections =
    buildConnections(routes);

  const transitAdjacency =
    buildTransitAdjacency(connections);

  const walkingAdjacency =
    buildWalkingAdjacency(
      stopsMap,
      300
    );

  const bestCost = new Map();
  const predecessor = new Map();
  const queue = new MinHeap();

  for (const stopId of stopsMap.keys()) {
    bestCost.set(stopId, Infinity);
  }

  for (const stop of originStops) {
    const cost =
      stop.walkTimeMins;

    if (
      cost <
      (bestCost.get(stop.id) ?? Infinity)
    ) {
      bestCost.set(
        stop.id,
        cost
      );

      predecessor.set(
        stop.id,
        {
          type: 'ORIGIN_WALK',
          fromStopId: null,
          toStopId: stop.id,
          duration: stop.walkTimeMins,
          distanceMeters: stop.distanceMeters
        }
      );

      queue.push({
        stopId: stop.id,
        cost
      });
    }
  }

  let bestDestinationCost =
    Infinity;

  let bestDestinationStopId =
    null;

  while (queue.size > 0) {
    const current =
      queue.pop();

    if (!current) {
      break;
    }

    const currentBest =
      bestCost.get(current.stopId);

    if (
      current.cost !==
      currentBest
    ) {
      continue;
    }

    if (
      current.cost >=
      bestDestinationCost
    ) {
      continue;
    }

    if (
      destinationMap.has(
        current.stopId
      )
    ) {
      const destinationStop =
        destinationMap.get(
          current.stopId
        );

      const totalCost =
        current.cost +
        destinationStop.walkTimeMins;

      if (
        totalCost <
        bestDestinationCost
      ) {
        bestDestinationCost =
          totalCost;

        bestDestinationStopId =
          current.stopId;
      }
    }

    const transitEdges =
      transitAdjacency.get(
        current.stopId
      ) || [];

    for (const edge of transitEdges) {
      const nextCost =
        current.cost +
        edge.duration;

      const oldCost =
        bestCost.get(edge.toStopId) ??
        Infinity;

      if (nextCost < oldCost) {
        bestCost.set(
          edge.toStopId,
          nextCost
        );

        predecessor.set(
          edge.toStopId,
          {
            type: 'TRANSIT',
            fromStopId:
              current.stopId,
            toStopId:
              edge.toStopId,
            duration:
              edge.duration,
            routeId:
              edge.routeId,
            routeName:
              edge.routeName,
            routeColor:
              edge.routeColor,
            route:
              edge.route,
            fromIndex:
              edge.fromIndex,
            toIndex:
              edge.toIndex
          }
        );

        queue.push({
          stopId:
            edge.toStopId,
          cost:
            nextCost
        });
      }
    }

    const walkingEdges =
      walkingAdjacency.get(
        current.stopId
      ) || [];

    for (const edge of walkingEdges) {
      const nextCost =
        current.cost +
        edge.duration;

      const oldCost =
        bestCost.get(edge.toStopId) ??
        Infinity;

      if (nextCost < oldCost) {
        bestCost.set(
          edge.toStopId,
          nextCost
        );

        predecessor.set(
          edge.toStopId,
          {
            type: 'TRANSFER_WALK',
            fromStopId:
              current.stopId,
            toStopId:
              edge.toStopId,
            duration:
              edge.duration,
            distanceMeters:
              edge.distanceMeters
          }
        );

        queue.push({
          stopId:
            edge.toStopId,
          cost:
            nextCost
        });
      }
    }
  }

  if (
    bestDestinationStopId === null ||
    bestDestinationCost === Infinity
  ) {
    console.log(
      'No network journey found.'
    );

    return {
      options: []
    };
  }

  const rawSteps =
    reconstructPath(
      predecessor,
      bestDestinationStopId
    );

  const steps =
    mergeTransitSteps(
      rawSteps
    );

  const transitSteps =
    steps.filter(
      step =>
        step.type === 'TRANSIT'
    );

  if (
    transitSteps.length === 0
  ) {
    return {
      options: []
    };
  }

  const legs = [];

  const originStep =
    steps.find(
      step =>
        step.type ===
        'ORIGIN_WALK'
    );

  if (originStep) {
    const firstStop =
      stopsMap.get(
        originStep.toStopId
      );

    if (firstStop) {
      legs.push({
        type: 'WALK',
        from:
          origin.label ||
          'Starting Location',
        to:
          firstStop.name,
        duration:
          originStep.duration,
        dist:
          originStep.distanceMeters
      });
    }
  }

  for (const step of steps) {
    if (
      step.type ===
      'ORIGIN_WALK'
    ) {
      continue;
    }

    if (
      step.type ===
      'TRANSFER_WALK'
    ) {
      const fromStop =
        stopsMap.get(
          step.fromStopId
        );

      const toStop =
        stopsMap.get(
          step.toStopId
        );

      if (
        fromStop &&
        toStop
      ) {
        legs.push({
          type: 'WALK',
          from:
            fromStop.name,
          to:
            toStop.name,
          duration:
            step.duration,
          dist:
            step.distanceMeters
        });
      }

      continue;
    }

    if (
      step.type ===
      'TRANSIT'
    ) {
      const fromStop =
        stopsMap.get(
          step.fromStopId
        );

      const toStop =
        stopsMap.get(
          step.toStopId
        );

      if (
        !fromStop ||
        !toStop
      ) {
        continue;
      }

      const routeStops =
        step.route?.stops || [];

      const segmentStops =
        routeStops.slice(
          step.fromIndex,
          step.toIndex + 1
        );

      legs.push({
        type: 'TRANSIT',
        routeNumber:
          step.routeId,
        routeName:
          step.routeName,
        color:
          step.routeColor,
        fromStop:
          fromStop.name,
        toStop:
          toStop.name,
        duration:
          step.duration,
        stops:
          segmentStops,
        pathPoints:
          step.route?.allPathPoints ||
          []
      });
    }
  }

  const destinationStop =
    destinationMap.get(
      bestDestinationStopId
    );

  const finalStop =
    stopsMap.get(
      bestDestinationStopId
    );

  if (
    destinationStop &&
    finalStop
  ) {
    legs.push({
      type: 'WALK',
      from:
        finalStop.name,
      to:
        destination.label ||
        'Destination Location',
      duration:
        destinationStop.walkTimeMins,
      dist:
        destinationStop.distanceMeters
    });
  }

  const uniqueTransitRoutes = [];

  for (const step of transitSteps) {
    if (
      uniqueTransitRoutes.length === 0 ||
      uniqueTransitRoutes[
        uniqueTransitRoutes.length - 1
      ].routeId !== step.routeId
    ) {
      uniqueTransitRoutes.push(
        step
      );
    }
  }

  const firstTransit =
    uniqueTransitRoutes[0];

  const lastTransit =
    uniqueTransitRoutes[
      uniqueTransitRoutes.length - 1
    ];

  const transfers =
    Math.max(
      0,
      uniqueTransitRoutes.length - 1
    );

  const primaryRoute =
    firstTransit.route;

  const option = {
    primaryRouteNumber:
      firstTransit.routeId,

    primaryRouteName:
      firstTransit.routeName,

    primaryColor:
      firstTransit.routeColor,

    totalDuration:
      bestDestinationCost,

    isActiveNow:
      true,

    operatingHours:
      primaryRoute?.operatingHours ||
      (
        primaryRoute?.startMins !== undefined &&
        primaryRoute?.endMins !== undefined
          ? `${minsToTimeStr(
              primaryRoute.startMins
            )} - ${minsToTimeStr(
              primaryRoute.endMins
            )}`
          : 'Schedule unavailable'
      ),

    nextDepartureStr:
      'Route available',

    arrivalTimeStr:
      `${bestDestinationCost} min travel time`,

    boardStopId:
      firstTransit.fromStopId,

    alightStopId:
      lastTransit.toStopId,

    allRouteStops:
      primaryRoute?.stops || [],

    allPathPoints:
      primaryRoute?.allPathPoints || [],

    transfers,

    routeSequence:
      uniqueTransitRoutes.map(
        step => ({
          routeId:
            step.routeId,
          routeName:
            step.routeName
        })
      ),

    legs
  };

  console.log(
    'Journey found:',
    option.routeSequence
      .map(
        route =>
          route.routeId
      )
      .join(' -> ')
  );

  console.log(
    'Transfers:',
    transfers
  );

  console.log(
    'Estimated total duration:',
    bestDestinationCost,
    'minutes'
  );

  return {
    options: [
      option
    ]
  };
}

module.exports = {
  calculateDistanceMeters,
  findNearbyStops,
  buildConnections,
  runCSA
};