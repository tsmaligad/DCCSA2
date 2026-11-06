const { performance } = require('perf_hooks');
const { minsToTimeStr } = require('./routesLoader');

const WALK_SPEED_METERS_PER_MINUTE = 50;

const MAX_ACCESS_WALK_METERS = 1500;
const MAX_TRANSFER_WALK_METERS = 500;

const DEFAULT_FREQUENCY_MINUTES = 15;
const DEFAULT_DEPARTURE_TIME = '00:00';

const MINUTES_PER_STOP = 7;

const FINAL_WALK_IMPROVEMENT_METERS = 200;

function calculateDistanceMeters(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371e3;

  const dLat =
    (lat2 - lat1) * Math.PI / 180;

  const dLon =
    (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const boundedA =
    Math.min(
      1,
      Math.max(0, a)
    );

  const c =
    2 *
    Math.atan2(
      Math.sqrt(boundedA),
      Math.sqrt(1 - boundedA)
    );

  return Math.round(R * c);
}

function walkMinutes(distanceMeters) {
  if (distanceMeters <= 5) return 0;
  return Math.max(1, Math.ceil((distanceMeters / 100) * 2));
}

function timeStrToMinutes(value) {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value !== 'string' ||
    !value.includes(':')
  ) {
    return 0;
  }

  const [hours, minutes] =
    value
      .split(':')
      .map(Number);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return 0;
  }

  return (
    hours * 60 +
    minutes
  );
}

function getRouteStart(route) {
  if (
    Number.isFinite(
      route.startMins
    )
  ) {
    return route.startMins;
  }

  if (route.startTime) {
    return timeStrToMinutes(
      route.startTime
    );
  }

  return 360;
}

function getRouteEnd(route) {
  if (
    Number.isFinite(
      route.endMins
    )
  ) {
    return route.endMins;
  }

  if (route.endTime) {
    return timeStrToMinutes(
      route.endTime
    );
  }

  return 1260;
}

function getRouteFrequency(route) {
  const values = [
    route.frequencyMins,
    route.frequency,
    route.headway,
    route.headwayMins
  ];

  for (const value of values) {
    const parsed =
      Number(value);

    if (
      Number.isFinite(parsed) &&
      parsed > 0
    ) {
      return parsed;
    }
  }

  return DEFAULT_FREQUENCY_MINUTES;
}

function findNearbyStops(
  lat,
  lng,
  stopsMap,
  maxDistanceMeters =
    MAX_ACCESS_WALK_METERS
) {
  const nearby = [];

  for (
    const [id, stop]
    of stopsMap.entries()
  ) {
    const distanceMeters =
      calculateDistanceMeters(
        lat,
        lng,
        stop.lat,
        stop.lng
      );

    if (
      distanceMeters <=
      maxDistanceMeters
    ) {
      nearby.push({
        ...stop,

        id,

        distanceMeters,

        walkTimeMins:
          walkMinutes(
            distanceMeters
          )
      });
    }
  }

  return nearby.sort(
    (a, b) =>
      a.distanceMeters -
      b.distanceMeters
  );
}

function buildConnections(routes) {
  const connections = [];

  for (const route of routes) {
    if (
      !Array.isArray(route.stops) ||
      route.stops.length < 2
    ) {
      continue;
    }

    const startMins =
      getRouteStart(route);

    const endMins =
      getRouteEnd(route);

    const frequencyMins =
      getRouteFrequency(route);

    for (
      let tripStart =
        startMins;

      tripStart <= endMins;

      tripStart +=
        frequencyMins
    ) {
      const tripId = `${route.variantId || route.fileName || route.id}_${tripStart}`;

      for (
        let i = 0;
        i < route.stops.length - 1;
        i++
      ) {
        const depStop =
          route.stops[i];

        const arrStop =
          route.stops[i + 1];

        const depTime =
          tripStart +
          i * MINUTES_PER_STOP;

        const arrTime =
          depTime +
          MINUTES_PER_STOP;

        connections.push({
          depStopId:
            depStop.id,

          arrStopId:
            arrStop.id,

          depTime,

          arrTime,

          duration:
            MINUTES_PER_STOP,

          tripId,

          routeId:
            route.id,

          routeName:
            route.name,

          routeColor:
            route.color ||
            '#ff8300',

          route,

          fromIndex: i,

          toIndex: i + 1
        });
      }
    }
  }

  connections.sort(
    (a, b) => {
      if (
        a.depTime !==
        b.depTime
      ) {
        return (
          a.depTime -
          b.depTime
        );
      }

      return (
        a.arrTime -
        b.arrTime
      );
    }
  );

  return connections;
}

function buildFootpaths(
  stopsMap,
  maxDistanceMeters =
    MAX_TRANSFER_WALK_METERS
) {
  const footpaths =
    new Map();

  const stops =
    Array.from(
      stopsMap.values()
    );

  for (const stop of stops) {
    footpaths.set(
      stop.id,
      []
    );
  }

  for (
    let i = 0;
    i < stops.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < stops.length;
      j++
    ) {
      const fromStop =
        stops[i];

      const toStop =
        stops[j];

      const distanceMeters =
        calculateDistanceMeters(
          fromStop.lat,
          fromStop.lng,
          toStop.lat,
          toStop.lng
        );

      if (
        distanceMeters >
        maxDistanceMeters
      ) {
        continue;
      }

      const duration =
        walkMinutes(
          distanceMeters
        );

      footpaths
        .get(fromStop.id)
        .push({
          fromStopId:
            fromStop.id,

          toStopId:
            toStop.id,

          distanceMeters,

          duration
        });

      footpaths
        .get(toStop.id)
        .push({
          fromStopId:
            toStop.id,

          toStopId:
            fromStop.id,

          distanceMeters,

          duration
        });
    }
  }

  return footpaths;
}

function findFirstConnectionIndex(
  connections,
  departureTime
) {
  let low = 0;
  let high =
    connections.length;

  while (low < high) {
    const middle =
      Math.floor(
        (low + high) / 2
      );

    if (
      connections[middle]
        .depTime <
      departureTime
    ) {
      low =
        middle + 1;
    } else {
      high =
        middle;
    }
  }

  return low;
}

function clonePath(path) {
  return path.map(
    step => ({
      ...step
    })
  );
}

function addTransitToPath(
  path,
  connection
) {
  const result =
    clonePath(path);

  result.push({
    type:
      'TRANSIT_EDGE',

    fromStopId:
      connection.depStopId,

    toStopId:
      connection.arrStopId,

    depTime:
      connection.depTime,

    arrTime:
      connection.arrTime,

    duration:
      connection.duration,

    tripId:
      connection.tripId,

    routeId:
      connection.routeId,

    routeName:
      connection.routeName,

    routeColor:
      connection.routeColor,

    route:
      connection.route,

    fromIndex:
      connection.fromIndex,

    toIndex:
      connection.toIndex
  });

  return result;
}

function addWalkToPath(
  path,
  footpath
) {
  const result =
    clonePath(path);

  result.push({
    type:
      'TRANSFER_WALK',

    fromStopId:
      footpath.fromStopId,

    toStopId:
      footpath.toStopId,

    duration:
      footpath.duration,

    distanceMeters:
      footpath.distanceMeters
  });

  return result;
}

function pathHasTransit(path) {
  return path.some(
    step =>
      step.type ===
      'TRANSIT_EDGE'
  );
}

function mergeTransitSteps(path) {
  const merged = [];

  for (const step of path) {
    if (
      step.type !==
      'TRANSIT_EDGE'
    ) {
      merged.push({
        ...step
      });

      continue;
    }

    const previous =
      merged[
        merged.length - 1
      ];

    if (
      previous &&
      previous.type ===
        'TRANSIT_EDGE' &&
      previous.tripId ===
        step.tripId &&
      previous.toStopId ===
        step.fromStopId
    ) {
      previous.toStopId =
        step.toStopId;

      previous.arrTime =
        step.arrTime;

      previous.duration +=
        step.duration;

      previous.toIndex =
        step.toIndex;
    } else {
      merged.push({
        ...step
      });
    }
  }

  return merged;
}

function calculateTransfers(
  path
) {
  const transitLegs =
    mergeTransitSteps(path)
      .filter(
        step =>
          step.type ===
          'TRANSIT_EDGE'
      );

  if (
    transitLegs.length === 0
  ) {
    return 0;
  }

  return Math.max(
    0,
    transitLegs.length - 1
  );
}

function calculateWalkingDistance(
  path,
  destinationStop
) {
  let total = 0;

  for (const step of path) {
    if (
      step.type ===
        'ORIGIN_WALK' ||
      step.type ===
        'TRANSFER_WALK'
    ) {
      total +=
        step.distanceMeters ||
        0;
    }
  }

  if (destinationStop) {
    total +=
      destinationStop
        .distanceMeters ||
      0;
  }

  return Math.round(total);
}

function relaxFootpaths({
  sourceStopId,
  sourceArrivalTime,
  earliestArrival,
  paths,
  footpaths,
  metrics
}) {
  const outgoing =
    footpaths.get(
      sourceStopId
    ) || [];

  for (
    const footpath
    of outgoing
  ) {
    metrics
      .footpathsChecked++;

    const candidateArrival =
      sourceArrivalTime +
      footpath.duration;

    const currentArrival =
      earliestArrival.get(
        footpath.toStopId
      ) ?? Infinity;

    if (
      candidateArrival >=
      currentArrival
    ) {
      continue;
    }

    earliestArrival.set(
      footpath.toStopId,
      candidateArrival
    );

    const sourcePath =
      paths.get(
        sourceStopId
      ) || [];

    paths.set(
      footpath.toStopId,
      addWalkToPath(
        sourcePath,
        footpath
      )
    );

    metrics.stopsUpdated++;

    metrics
      .footpathsRelaxed++;
  }
}


function isBetterDestinationCandidate({
  candidateStop,
  candidateArrival,
  candidatePath,
  currentStop,
  currentArrival,
  currentPath
}) {
  if (!currentStop) return true;

  if (candidateArrival < currentArrival) return true;
  if (candidateArrival > currentArrival) return false;

  const candidateTransfers = calculateTransfers(candidatePath);
  const currentTransfers = calculateTransfers(currentPath || []);

  if (candidateTransfers < currentTransfers) return true;
  if (candidateTransfers > currentTransfers) return false;

  return calculateWalkingDistance(candidatePath, candidateStop) <
    calculateWalkingDistance(currentPath || [], currentStop);
}


function evaluateDestination({
  destinationStops,
  earliestArrival,
  paths,
  bestDestinationArrival,
  bestDestinationStop,
  bestDestinationPath,
  metrics
}) {
  let bestArrival =
    bestDestinationArrival;

  let bestStop =
    bestDestinationStop;

  let bestPath =
    bestDestinationPath;

  for (
    const destinationStop
    of destinationStops
  ) {
    const stopArrival =
      earliestArrival.get(
        destinationStop.id
      ) ?? Infinity;

    if (
      stopArrival ===
      Infinity
    ) {
      continue;
    }

    const destinationPath =
      paths.get(
        destinationStop.id
      ) || [];

    if (
      !pathHasTransit(
        destinationPath
      )
    ) {
      continue;
    }

    metrics
      .destinationCandidatesEvaluated++;

    const arrivalAtDestination =
      stopArrival +
      destinationStop
        .walkTimeMins;

    if (
      isBetterDestinationCandidate({
        candidateStop:
          destinationStop,

        candidateArrival:
          arrivalAtDestination,

        candidatePath:
          destinationPath,

        currentStop:
          bestStop,

        currentArrival:
          bestArrival,

        currentPath:
          bestPath || []
      })
    ) {
      bestArrival =
        arrivalAtDestination;

      bestStop =
        destinationStop;

      bestPath =
        clonePath(
          destinationPath
        );
    }
  }

  return {
    bestDestinationArrival:
      bestArrival,

    bestDestinationStop:
      bestStop,

    bestDestinationPath:
      bestPath
  };
}

function buildLegs({
  path,
  origin,
  destination,
  destinationStop,
  stopsMap
}) {
  const merged =
    mergeTransitSteps(path);

  const legs = [];

  for (const step of merged) {
    if (
      step.type ===
      'ORIGIN_WALK'
    ) {
      const stop =
        stopsMap.get(
          step.toStopId
        );

      if (!stop) {
        continue;
      }

      legs.push({
        type: 'WALK',

        from:
          origin.label ||
          'Starting Location',

        to:
          stop.name,

        duration:
          step.duration,

        dist:
          step.distanceMeters
      });

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
        !fromStop ||
        !toStop
      ) {
        continue;
      }

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

      continue;
    }

    if (
      step.type ===
      'TRANSIT_EDGE'
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
        step.route?.stops ||
        [];

      const segmentStops =
        routeStops.slice(
          step.fromIndex,
          step.toIndex + 1
        );

      legs.push({
        type:
          'TRANSIT',

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

        departureTime:
          minsToTimeStr(
            step.depTime
          ),

        arrivalTime:
          minsToTimeStr(
            step.arrTime
          ),

        duration:
          step.duration,

        stops:
          segmentStops,

        pathPoints:
          step.route
            ?.allPathPoints ||
          []
      });
    }
  }

  if (destinationStop) {
    const finalStop =
      stopsMap.get(
        destinationStop.id
      );

    if (finalStop) {
      legs.push({
        type: 'WALK',

        from:
          finalStop.name,

        to:
          destination.label ||
          'Destination Location',

        duration:
          destinationStop
            .walkTimeMins,

        dist:
          destinationStop
            .distanceMeters
      });
    }
  }

  return legs;
}

function runCSA({
  origin,
  destination,
  departureTime,
  routes,
  stopsMap
}) {
  console.log(
    'CANONICAL CSA ROUTING IS RUNNING'
  );

  const queryDepartureTime =
    timeStrToMinutes(
      departureTime ||
      DEFAULT_DEPARTURE_TIME
    );

  const originStops =
    findNearbyStops(
      origin.lat,
      origin.lng,
      stopsMap,
      MAX_ACCESS_WALK_METERS
    );

  const destinationStops =
    findNearbyStops(
      destination.lat,
      destination.lng,
      stopsMap,
      MAX_ACCESS_WALK_METERS
    );

  console.log(
    'Origin nearby stops:',
    originStops.length
  );

  console.log(
    'Destination nearby stops:',
    destinationStops.length
  );

  if (
    originStops.length === 0 ||
    destinationStops.length === 0
  ) {
    return {
      options: [],

      metrics: {
        algorithm: 'CSA',

        executionTimeMs: 0,

        preprocessingTimeMs: 0,

        memoryDeltaBytes: 0,

        connectionsScanned: 0,

        stopsUpdated: 0,

        footpathsChecked: 0,

        footpathsRelaxed: 0,

        destinationCandidatesEvaluated:
          0,

        simulatedTravelTime:
          null,

        transfers: null,

        walkingDistanceMeters:
          null
      }
    };
  }

  const preprocessingStart =
    performance.now();

  const connections =
    buildConnections(routes);

  const footpaths =
    buildFootpaths(
      stopsMap,
      MAX_TRANSFER_WALK_METERS
    );

  const preprocessingEnd =
    performance.now();

  console.log(
    'Connections built:',
    connections.length
  );

  console.log(
    'Routes loaded:',
    routes.length
  );

  const earliestArrival =
    new Map();

  const paths =
    new Map();

  const reachedTrips =
    new Map();

  for (
    const stopId
    of stopsMap.keys()
  ) {
    earliestArrival.set(
      stopId,
      Infinity
    );
  }

  const metrics = {
    algorithm: 'CSA',

    preprocessingTimeMs:
      preprocessingEnd -
      preprocessingStart,

    executionTimeMs: 0,

    memoryDeltaBytes: 0,

    connectionsScanned: 0,

    stopsUpdated: 0,

    footpathsChecked: 0,

    footpathsRelaxed: 0,

    destinationCandidatesEvaluated:
      0,

    simulatedTravelTime:
      null,

    transfers: null,

    walkingDistanceMeters:
      null,

    totalConnections:
      connections.length,

    departureTime:
      minsToTimeStr(
        queryDepartureTime
      )
  };

  for (
    const stop
    of originStops
  ) {
    const arrivalTime =
      queryDepartureTime +
      stop.walkTimeMins;

    const currentArrival =
      earliestArrival.get(
        stop.id
      ) ?? Infinity;

    if (
      arrivalTime <
      currentArrival
    ) {
      earliestArrival.set(
        stop.id,
        arrivalTime
      );

      paths.set(
        stop.id,
        [
          {
            type:
              'ORIGIN_WALK',

            fromStopId:
              null,

            toStopId:
              stop.id,

            duration:
              stop.walkTimeMins,

            distanceMeters:
              stop.distanceMeters
          }
        ]
      );

      metrics
        .stopsUpdated++;
    }
  }

  const firstConnectionIndex =
    findFirstConnectionIndex(
      connections,
      queryDepartureTime
    );

  let bestDestinationArrival =
    Infinity;

  let bestDestinationStop =
    null;

  let bestDestinationPath =
    null;

  const memoryBefore =
    process
      .memoryUsage()
      .heapUsed;

  const algorithmStart =
    performance.now();

  for (
    let index =
      firstConnectionIndex;

    index <
      connections.length;

    index++
  ) {
    const connection =
      connections[index];

    metrics
      .connectionsScanned++;

    const arrivalAtDepartureStop =
      earliestArrival.get(
        connection.depStopId
      ) ?? Infinity;

    const tripState =
      reachedTrips.get(
        connection.tripId
      );

    const tripAlreadyReached =
      Boolean(tripState);

    const canBoardAtStop =
      arrivalAtDepartureStop <=
      connection.depTime;

    if (
      !tripAlreadyReached &&
      !canBoardAtStop
    ) {
      continue;
    }

    let pathBeforeConnection;

    if (
      tripAlreadyReached
    ) {
      pathBeforeConnection =
        tripState.path;
    } else {
      pathBeforeConnection =
        paths.get(
          connection.depStopId
        ) || [];
    }

    const transitPath =
      addTransitToPath(
        pathBeforeConnection,
        connection
      );

    reachedTrips.set(
      connection.tripId,
      {
        path:
          transitPath,

        arrivalTime:
          connection.arrTime,

        lastStopId:
          connection.arrStopId
      }
    );

    const oldArrival =
      earliestArrival.get(
        connection.arrStopId
      ) ?? Infinity;

    if (
      connection.arrTime <
      oldArrival
    ) {
      earliestArrival.set(
        connection.arrStopId,
        connection.arrTime
      );

      paths.set(
        connection.arrStopId,
        transitPath
      );

      metrics
        .stopsUpdated++;

      relaxFootpaths({
        sourceStopId:
          connection.arrStopId,

        sourceArrivalTime:
          connection.arrTime,

        earliestArrival,

        paths,

        footpaths,

        metrics
      });
    }

    const destinationResult =
      evaluateDestination({
        destinationStops,

        earliestArrival,

        paths,

        bestDestinationArrival,

        bestDestinationStop,

        bestDestinationPath,

        metrics
      });

    bestDestinationArrival =
      destinationResult
        .bestDestinationArrival;

    bestDestinationStop =
      destinationResult
        .bestDestinationStop;

    bestDestinationPath =
      destinationResult
        .bestDestinationPath;
  }

  const algorithmEnd =
    performance.now();

  const memoryAfter =
    process
      .memoryUsage()
      .heapUsed;

  metrics.executionTimeMs =
    algorithmEnd -
    algorithmStart;

  metrics.memoryDeltaBytes =
    memoryAfter -
    memoryBefore;

  console.log(
    'Connections scanned:',
    metrics
      .connectionsScanned
  );

  console.log(
    'Stops updated:',
    metrics
      .stopsUpdated
  );

  console.log(
    'Footpaths relaxed:',
    metrics
      .footpathsRelaxed
  );

  console.log(
    'Destination candidates:',
    metrics
      .destinationCandidatesEvaluated
  );

  if (
    !bestDestinationStop ||
    !bestDestinationPath ||
    bestDestinationArrival ===
      Infinity
  ) {
    console.log(
      'No transit journey found.'
    );

    return {
      options: [],
      metrics
    };
  }

  if (
    !pathHasTransit(
      bestDestinationPath
    )
  ) {
    console.log(
      'No valid bus journey found.'
    );

    console.log('THESIS CSA RESULT:', JSON.stringify({
      departureTime: metrics.departureTime,
      journeyDepartureTime: metrics.journeyDepartureTime,
      arrivalTime: metrics.arrivalTime,
      transfers: metrics.transfers,
      routeSequence: metrics.routeSequence,
      simulatedTravelTime: metrics.simulatedTravelTime,
      walkingDistanceMeters: metrics.walkingDistanceMeters,
      legs: option.legs
    }, null, 2));

    return {
      options: [],
      metrics
    };
  }

  const path =
    bestDestinationPath;

  const mergedTransitSteps =
    mergeTransitSteps(path)
      .filter(
        step =>
          step.type ===
          'TRANSIT_EDGE'
      );

  if (
    mergedTransitSteps.length ===
    0
  ) {
    return {
      options: [],
      metrics
    };
  }

  const firstTransit =
    mergedTransitSteps[0];

  const lastTransit =
    mergedTransitSteps[
      mergedTransitSteps.length -
      1
    ];

  const transfers =
    calculateTransfers(path);

  const walkingDistanceMeters =
    calculateWalkingDistance(
      path,
      bestDestinationStop
    );

  const initialWalkMinutes =
    path.find(
      step =>
        step.type === 'ORIGIN_WALK'
    )?.duration || 0;

  const journeyDepartureTime =
    Math.max(
      queryDepartureTime,
      firstTransit.depTime - initialWalkMinutes
    );

  const simulatedTravelTime =
    bestDestinationArrival -
    journeyDepartureTime;

  metrics
    .simulatedTravelTime =
    simulatedTravelTime;

  metrics.journeyDepartureTime =
    minsToTimeStr(
      journeyDepartureTime
    );

  metrics.transfers =
    transfers;

  metrics
    .walkingDistanceMeters =
    walkingDistanceMeters;

  metrics.arrivalTime =
    minsToTimeStr(
      bestDestinationArrival
    );

  metrics.finalWalkMeters =
    bestDestinationStop
      .distanceMeters;

  metrics.routeSequence =
    mergedTransitSteps.map(
      step => ({
        routeId:
          step.routeId,

        routeName:
          step.routeName,

        tripId:
          step.tripId
      })
    );

  const legs =
    buildLegs({
      path,

      origin,

      destination,

      destinationStop:
        bestDestinationStop,

      stopsMap
    });

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
      simulatedTravelTime,

    isActiveNow: true,

    operatingHours:
      primaryRoute
        ?.operatingHours ||
      (
        primaryRoute
          ?.startMins !==
          undefined &&
        primaryRoute
          ?.endMins !==
          undefined
          ? `${minsToTimeStr(
              primaryRoute
                .startMins
            )} - ${minsToTimeStr(
              primaryRoute
                .endMins
            )}`
          :
          'Schedule unavailable'
      ),

    nextDepartureStr:
      minsToTimeStr(
        firstTransit.depTime
      ),

    arrivalTimeStr:
      minsToTimeStr(
        bestDestinationArrival
      ),

    departureTimeStr:
      minsToTimeStr(
        journeyDepartureTime
      ),

    boardStopId:
      firstTransit
        .fromStopId,

    alightStopId:
      lastTransit
        .toStopId,

    allRouteStops:
      primaryRoute
        ?.stops ||
      [],

    allPathPoints:
      primaryRoute
        ?.allPathPoints ||
      [],

    transfers,

    walkingDistanceMeters,

    finalWalkMeters:
      bestDestinationStop
        .distanceMeters,

    simulatedTravelTime,

    routeSequence:
      metrics.routeSequence,

    legs
  };

  console.log(
    'CSA journey found:',
    metrics
      .routeSequence
      .map(
        route =>
          route.routeId
      )
      .join(' -> ')
  );

  console.log(
    'Journey departure:',
    minsToTimeStr(
      journeyDepartureTime
    )
  );

  console.log(
    'Arrival:',
    minsToTimeStr(
      bestDestinationArrival
    )
  );

  console.log(
    'Simulated travel time:',
    simulatedTravelTime,
    'minutes'
  );

  console.log(
    'Transfers:',
    transfers
  );

  console.log(
    'Total walking distance:',
    walkingDistanceMeters,
    'meters'
  );

  console.log(
    'Final walk:',
    bestDestinationStop
      .distanceMeters,
    'meters'
  );

  console.log(
    'CSA execution time:',
    metrics
      .executionTimeMs
      .toFixed(4),
    'ms'
  );

  return {
    options: [
      option
    ],

    metrics
  };
}

module.exports = {
  calculateDistanceMeters,

  findNearbyStops,

  buildConnections,

  buildFootpaths,

  findFirstConnectionIndex,

  runCSA
};