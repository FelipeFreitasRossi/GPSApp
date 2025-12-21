import { addWalk } from "@/store/walkSlice";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import haversine from "haversine";
import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  useColorScheme,
  View,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
  Dimensions,
  Switch,
  PanResponder,
  Alert,
} from "react-native";
import "react-native-get-random-values";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import { RootState } from "@/store";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// Importe as constantes e tipos
import { MAP_CONFIGS, WALK_MODES, darkMapStyle, lightMapStyle } from "@/constants/walk";
import { SAMPLE_POIS, EXPLORATION_AREAS } from "@/constants/exploration";
import { FITNESS_GOALS, WORKOUT_PLANS, ACHIEVEMENTS } from "@/constants/fitness";
import { MapType, WalkMode, AppWalkPoint, Poi, ExplorationArea, FitnessGoal, WorkoutPlan } from "@/types/map";

const { width, height } = Dimensions.get('window');

export default function WalkApp() {
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [route, setRoute] = useState<AppWalkPoint[]>([]);
  const [isWalking, setIsWalking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [calories, setCalories] = useState(0);
  const [compassHeading, setCompassHeading] = useState(0);
  
  const [mapType, setMapType] = useState<MapType>('standard');
  const [walkMode, setWalkMode] = useState<WalkMode>('navigation');
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showMapInfo, setShowMapInfo] = useState(true);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showPOI, setShowPOI] = useState(true);
  const [isMapDragging, setIsMapDragging] = useState(false);
  
  // Estados para modo Exploração
  const [pois, setPois] = useState<Poi[]>(SAMPLE_POIS);
  const [explorationAreas, setExplorationAreas] = useState<ExplorationArea[]>(EXPLORATION_AREAS);
  const [discoveredPois, setDiscoveredPois] = useState<string[]>([]);
  const [showPoiDetails, setShowPoiDetails] = useState<string | null>(null);
  const [showAreaDetails, setShowAreaDetails] = useState<string | null>(null);
  
  // Estados para modo Fitness
  const [fitnessGoals, setFitnessGoals] = useState<FitnessGoal[]>(FITNESS_GOALS);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>(WORKOUT_PLANS);
  const [achievements, setAchievements] = useState(ACHIEVEMENTS);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutPlan | null>(null);
  const [currentInterval, setCurrentInterval] = useState<number>(0);
  const [intervalTimeLeft, setIntervalTimeLeft] = useState<number>(0);
  const [workoutProgress, setWorkoutProgress] = useState<number>(0);
  const [showFitnessGoals, setShowFitnessGoals] = useState(false);
  const [showWorkoutPlans, setShowWorkoutPlans] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  
  const watchId = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const distanceRef = useRef<number>(0);
  const caloriesRef = useRef<number>(0);
  
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const dispatch = useDispatch();
  
  const history = useSelector((state: RootState) => state.walks.history);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideUpAnim = useRef(new Animated.Value(0)).current;
  const mapSelectorAnim = useRef(new Animated.Value(height)).current;
  const modeSelectorAnim = useRef(new Animated.Value(height)).current;

  const currentMap = MAP_CONFIGS[mapType];
  const currentMode = WALK_MODES[walkMode];

  // PanResponder para detectar arrastar no mapa
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setIsMapDragging(true),
      onPanResponderRelease: () => setTimeout(() => setIsMapDragging(false), 100),
    })
  ).current;

  useEffect(() => {
    initLocation();
    const compassInterval = startCompass();
    return () => {
      cleanup();
      cleanupWorkoutTimers();
      if (compassInterval) clearInterval(compassInterval);
    };
  }, []);

  // Animação do seletor de mapa
  useEffect(() => {
    Animated.timing(mapSelectorAnim, {
      toValue: showMapSelector ? 0 : height,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showMapSelector]);

  // Animação do seletor de modo
  useEffect(() => {
    Animated.timing(modeSelectorAnim, {
      toValue: showModeSelector ? 0 : height,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showModeSelector]);

  // Animação de entrada dos controles
  useEffect(() => {
    Animated.timing(slideUpAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Verificar POIs próximos no modo Exploração
  useEffect(() => {
    if (location && walkMode === 'exploration' && !isWalking) {
      checkNearbyPois();
      checkExplorationAreas();
    }
  }, [location, walkMode]);

  // Atualizar metas de fitness durante a caminhada
  useEffect(() => {
    if (walkMode === 'fitness' && isWalking) {
      updateFitnessGoals();
      checkWorkoutProgress();
      checkAchievements();
    }
  }, [distance, duration, calories, walkMode, isWalking]);

  const initLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Permissão de localização é necessária");
        return;
      }

      if (Platform.OS === 'ios') {
        const bgStatus = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus.status !== 'granted') {
          console.log('Permissão de background não concedida');
        }
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setLocation(loc.coords);
      setAccuracy(loc.coords.accuracy || null);
      
      watchId.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 3000,
        },
        (newLocation) => {
          setLocation(newLocation.coords);
          setAccuracy(newLocation.coords.accuracy || null);
        }
      );
    } catch (error) {
      console.error("Erro na localização:", error);
    }
  };

  const startCompass = () => {
    // Simulação simplificada de bússola
    return setInterval(() => {
      setCompassHeading(prev => (prev + 0.5) % 360);
    }, 100);
  };

  // --- FUNÇÕES PARA MODO EXPLORAÇÃO ---
  const checkNearbyPois = () => {
    if (!location) return;

    const updatedPois = pois.map(poi => {
      const distance = haversine(
        { latitude: location.latitude, longitude: location.longitude },
        poi.coords,
        { unit: 'meter' }
      );
      
      // Atualiza distância
      const updatedPoi = { ...poi, distance };
      
      // Verifica se o POI está próximo o suficiente para ser descoberto
      if (distance < 50 && !discoveredPois.includes(poi.id)) {
        if (!isWalking) {
          discoverPoi(poi.id);
        }
      }
      
      return updatedPoi;
    });
    
    setPois(updatedPois);
  };

  const checkExplorationAreas = () => {
    if (!location) return;

    const updatedAreas = explorationAreas.map(area => {
      const distance = haversine(
        { latitude: location.latitude, longitude: location.longitude },
        area.coords,
        { unit: 'meter' }
      );
      
      // Se estiver dentro da área, verifica POIs
      if (distance <= area.radius) {
        const areaPois = pois.filter(poi => {
          const poiDistance = haversine(area.coords, poi.coords, { unit: 'meter' });
          return poiDistance <= area.radius;
        });
        
        const discoveredInArea = areaPois.filter(poi => discoveredPois.includes(poi.id));
        
        return {
          ...area,
          pointsDiscovered: discoveredInArea.length,
          totalPoints: areaPois.length,
        };
      }
      
      return area;
    });
    
    setExplorationAreas(updatedAreas);
  };

  const discoverPoi = (poiId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setDiscoveredPois(prev => {
      if (!prev.includes(poiId)) {
        return [...prev, poiId];
      }
      return prev;
    });
    
    // Atualiza o POI como visitado
    setPois(prev => prev.map(poi => 
      poi.id === poiId ? { ...poi, visited: true } : poi
    ));
    
    // Mostra modal de descoberta
    const discoveredPoi = pois.find(p => p.id === poiId);
    if (discoveredPoi) {
      Alert.alert(
        '🎉 Ponto Descoberto!',
        `Você encontrou: ${discoveredPoi.name}\n${discoveredPoi.description || ''}`,
        [{ text: 'OK' }]
      );
    }
  };

  const navigateToPoi = (poiId: string) => {
    const poi = pois.find(p => p.id === poiId);
    if (poi && mapRef.current) {
      mapRef.current.animateCamera({
        center: poi.coords,
        zoom: 18,
      });
      setShowPoiDetails(poiId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const startExplorationWalk = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Inicia a caminhada de exploração
    setRoute([]);
    setDistance(0);
    setDuration(0);
    setDiscoveredPois([]);
    
    Alert.alert(
      '🚶‍♂️ Iniciando Exploração',
      'Explore a área para descobrir pontos de interesse! Você será notificado quando estiver próximo a um local interessante.',
      [{ text: 'Vamos lá!', onPress: startWalk }]
    );
  };

  // --- FUNÇÕES PARA MODO FITNESS ---
  const updateFitnessGoals = () => {
    const updatedGoals = fitnessGoals.map(goal => {
      let current = 0;
      
      switch (goal.type) {
        case 'distance':
          current = distance;
          break;
        case 'time':
          current = duration;
          break;
        case 'calories':
          current = calories;
          break;
        case 'steps':
          // Estimativa de passos (aproximadamente 1.4 passos por metro)
          current = Math.floor(distance * 1.4);
          break;
      }
      
      const achieved = current >= goal.target;
      
      if (achieved && !goal.achieved) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('🎯 Meta Atingida!', `Você alcançou sua meta de ${goal.type}!`);
      }
      
      return { ...goal, current, achieved };
    });
    
    setFitnessGoals(updatedGoals);
  };

  const checkAchievements = () => {
    const updatedAchievements = achievements.map(achievement => {
      let achieved = achievement.achieved;
      
      switch (achievement.id) {
        case 'first_walk':
          if (history.length > 0) achieved = true;
          break;
        case '5k':
          if (distance >= 5000) achieved = true;
          break;
        case 'marathon':
          const totalDistance = history.reduce((sum, walk) => sum + walk.distance, 0);
          if (totalDistance >= 42000) achieved = true;
          break;
        case 'early_bird':
          const now = new Date();
          if (now.getHours() < 6) achieved = true;
          break;
        case 'weekend_warrior':
          const weekendWalks = history.filter(walk => {
            const date = new Date(walk.date);
            return date.getDay() === 0 || date.getDay() === 6;
          });
          if (weekendWalks.length >= 5) achieved = true;
          break;
      }
      
      if (achieved && !achievement.achieved) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      return { ...achievement, achieved };
    });
    
    setAchievements(updatedAchievements);
  };

  const selectWorkoutPlan = (plan: WorkoutPlan) => {
    setSelectedPlan(plan);
    setShowWorkoutPlans(false);
    
    Alert.alert(
      `💪 ${plan.name}`,
      `Duração: ${plan.duration} minutos\n${plan.distance ? `Distância: ${(plan.distance / 1000).toFixed(1)} km` : 'Treino intervalado'}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Iniciar Treino', onPress: () => startWorkout(plan) },
      ]
    );
  };

  const startWorkout = (plan: WorkoutPlan) => {
    setActiveWorkout(plan);
    setCurrentInterval(0);
    setWorkoutProgress(0);
    
    if (plan.type === 'interval' && plan.intervals) {
      setIntervalTimeLeft(plan.intervals[0].duration);
    }
    
    // Inicia a caminhada
    startWalk();
    
    // Se for treino intervalado, inicia o timer de intervalos
    if (plan.type === 'interval' && plan.intervals) {
      startIntervalTimer(plan);
    }
  };

  const startIntervalTimer = (plan: WorkoutPlan) => {
    if (!plan.intervals) return;
    
    intervalTimerRef.current = setInterval(() => {
      setIntervalTimeLeft(prev => {
        if (prev <= 1) {
          // Troca de intervalo
          const nextInterval = currentInterval + 1;
          
          if (nextInterval < plan.intervals!.length) {
            setCurrentInterval(nextInterval);
            
            // Feedback háptico para mudança de intervalo
            Haptics.impactAsync(
              plan.intervals![nextInterval].type === 'work' 
                ? Haptics.ImpactFeedbackStyle.Heavy
                : Haptics.ImpactFeedbackStyle.Light
            );
            
            return plan.intervals![nextInterval].duration;
          } else {
            // Treino completo
            completeWorkout();
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);
  };

  const checkWorkoutProgress = () => {
    if (!activeWorkout) return;
    
    let progress = 0;
    
    if (activeWorkout.distance) {
      progress = (distance / activeWorkout.distance) * 100;
    } else if (activeWorkout.duration) {
      progress = (duration / (activeWorkout.duration * 60)) * 100;
    }
    
    setWorkoutProgress(Math.min(100, progress));
    
    // Verifica se completou o treino
    if (progress >= 100 && !activeWorkout.completed) {
      completeWorkout();
    }
  };

  const completeWorkout = () => {
    if (!activeWorkout) return;
    
    // Limpa timers
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
    if (workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
      workoutTimerRef.current = null;
    }
    
    // Atualiza plano como completado
    setWorkoutPlans(prev => prev.map(plan => 
      plan.id === activeWorkout.id ? { ...plan, completed: true } : plan
    ));
    
    // Para a caminhada
    stopWalk();
    
    // Feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    Alert.alert(
      '🏆 Treino Completo!',
      `Parabéns! Você completou: ${activeWorkout.name}\nDistância: ${(distance / 1000).toFixed(2)} km\nTempo: ${formatTime(duration)}\nCalorias: ${Math.round(calories)} cal`,
      [{ text: 'OK' }]
    );
    
    setActiveWorkout(null);
  };

  const cleanupWorkoutTimers = () => {
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
    if (workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
      workoutTimerRef.current = null;
    }
  };

  // --- FUNÇÕES PRINCIPAIS DE CAMINHADA ---
  const startWalk = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      setIsWalking(true);
      setIsPaused(false);
      setRoute([]);
      setDistance(0);
      setDuration(0);
      setAvgSpeed(0);
      setMaxSpeed(0);
      setCalories(0);
      distanceRef.current = 0;
      caloriesRef.current = 0;
      startTimeRef.current = Date.now();
      
      if (watchId.current) {
        watchId.current.remove();
        watchId.current = null;
      }

      // Animação de pulsação
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
        if (isWalking && !isPaused) {
          const newCalories = caloriesRef.current + (0.05 * 1.2);
          setCalories(newCalories);
          caloriesRef.current = newCalories;
        }
      }, 1000);

      // Configuração do GPS para rastreamento
      watchId.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 3,
          timeInterval: 1000,
          mayShowUserSettingsDialog: true,
        },
        handleLocationUpdate
      );
    } catch (error) {
      console.error("Erro ao iniciar caminhada:", error);
    }
  };

  const handleLocationUpdate = (newLocation: Location.LocationObject) => {
    if (!isWalking || isPaused) return;

    const newPoint: AppWalkPoint = {
      coords: newLocation.coords,
      timestamp: Date.now(),
      speed: newLocation.coords.speed || 0,
      altitude: newLocation.coords.altitude,
    };

    setLocation(newLocation.coords);
    setAccuracy(newLocation.coords.accuracy || null);
    
    const speedKmh = newLocation.coords.speed ? newLocation.coords.speed * 3.6 : 0;
    setCurrentSpeed(speedKmh);
    
    if (speedKmh > maxSpeed) {
      setMaxSpeed(speedKmh);
    }

    setRoute(prevRoute => {
      const updatedRoute = [...prevRoute, newPoint];
      
      if (prevRoute.length > 0) {
        const lastPoint = prevRoute[prevRoute.length - 1];
        const segmentDistance = haversine(
          {
            latitude: lastPoint.coords.latitude,
            longitude: lastPoint.coords.longitude
          },
          {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude
          },
          { unit: 'meter' }
        );
        
        if (segmentDistance < 100) {
          distanceRef.current += segmentDistance;
          setDistance(distanceRef.current);
          
          const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
          const avgSpeed = elapsedTime > 0 ? (distanceRef.current / elapsedTime) * 3.6 : 0;
          setAvgSpeed(avgSpeed);
        }
      }
      
      if (updatedRoute.length > 500) {
        return updatedRoute.slice(-250);
      }
      
      return updatedRoute;
    });

    if (mapRef.current && !isMapDragging) {
      mapRef.current.animateCamera({
        center: newLocation.coords,
        zoom: 16,
      });
    }
  };

  const pauseWalk = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    
    if (!newPausedState) {
      // Se estava pausado e agora vai continuar
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      // Se vai pausar
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const stopWalk = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setIsWalking(false);
    setIsPaused(false);
    pulseAnim.stopAnimation();
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (watchId.current) {
      watchId.current.remove();
      watchId.current = null;
    }
    
    if (route.length > 2 && distance > 10) {
      const walkData = {
        id: uuid(),
        distance: distanceRef.current,
        duration,
        date: new Date().toISOString(),
        route: route.map(point => ({
          latitude: point.coords.latitude,
          longitude: point.coords.longitude,
          altitude: point.coords.altitude,
          timestamp: point.timestamp,
        })),
        avgSpeed,
        maxSpeed,
        calories: Math.round(calories),
        mode: 'walking' as const,
        points: route.length,
        accuracy: accuracy || 0,
      };
      
      dispatch(addWalk(walkData));
      initLocation();
    }
  };

  const cleanup = () => {
    if (watchId.current) {
      watchId.current.remove();
      watchId.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const changeMapType = (type: MapType) => {
    setMapType(type);
    setShowMapSelector(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const changeWalkMode = (mode: WalkMode) => {
    setWalkMode(mode);
    setShowModeSelector(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const centerMap = () => {
    if (mapRef.current && location) {
      mapRef.current.animateCamera({
        center: location,
        zoom: 16,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const rotateNorth = () => {
    if (mapRef.current) {
      mapRef.current.animateCamera({
        heading: 0,
      });
      setCompassHeading(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <MaterialIcons name="gps-fixed" size={80} color="#2196F3" />
        </Animated.View>
        <Text style={styles.loadingText}>Obtendo localização...</Text>
        <Text style={styles.loadingSubtext}>Ativando serviços de GPS</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* MAPA PRINCIPAL */}
      <View style={styles.mapContainer} {...panResponder.panHandlers}>
        <MapView
          style={styles.map}
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          mapType={mapType}
          customMapStyle={colorScheme === "dark" ? darkMapStyle : lightMapStyle}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={true}
          zoomEnabled={true}
          zoomControlEnabled={false}
          rotateEnabled={true}
          pitchEnabled={true}
          showsTraffic={showTraffic}
          showsPointsOfInterest={showPOI}
          showsBuildings={true}
          toolbarEnabled={false}
        >
          {route.length > 0 && (
            <>
              <Polyline
                coordinates={route.map(p => p.coords)}
                strokeWidth={5}
                strokeColor={currentMode.color}
                strokeColors={[currentMode.color, `${currentMode.color}CC`]}
                lineDashPattern={isPaused ? [10, 5] : undefined}
              />
              {route.length > 1 && (
                <Marker coordinate={route[route.length - 1].coords}>
                  <Animated.View style={[styles.currentMarker, {
                    transform: [{ scale: pulseAnim }]
                  }]}>
                    <View style={[styles.markerInner, { backgroundColor: currentMode.color }]} />
                  </Animated.View>
                </Marker>
              )}
            </>
          )}

          {/* Marcadores de POIs no Mapa (para modo Exploração) */}
          {walkMode === 'exploration' && !isWalking && (
            <>
              {pois.map(poi => (
                <Marker
                  key={poi.id}
                  coordinate={poi.coords}
                  onPress={() => navigateToPoi(poi.id)}
                >
                  <Animated.View style={[
                    styles.poiMarker,
                    poi.visited && styles.poiMarkerVisited,
                    { 
                      backgroundColor: poi.visited ? '#4CAF50' : currentMode.color,
                      transform: [{ scale: pulseAnim }] 
                    }
                  ]}>
                    <MaterialIcons 
                      name={
                        poi.category === 'viewpoint' ? 'visibility' :
                        poi.category === 'natural' ? 'park' :
                        poi.category === 'historic' ? 'history' :
                        poi.category === 'restaurant' ? 'restaurant' :
                        'place'
                      } 
                      size={16} 
                      color="white" 
                    />
                    {poi.visited && (
                      <View style={styles.visitedBadge}>
                        <MaterialIcons name="check" size={10} color="white" />
                      </View>
                    )}
                  </Animated.View>
                </Marker>
              ))}
              
              {/* Áreas de exploração (círculos no mapa) */}
              {explorationAreas.map(area => (
                <Marker
                  key={area.id}
                  coordinate={area.coords}
                  onPress={() => setShowAreaDetails(area.id)}
                >
                  <View style={styles.areaMarker}>
                    <Text style={styles.areaMarkerText}>
                      {area.pointsDiscovered}/{area.totalPoints}
                    </Text>
                  </View>
                </Marker>
              ))}
            </>
          )}
        </MapView>
      </View>

      {/* CABEÇALHO SUPERIOR */}
      <Animated.View 
        style={[
          styles.header,
          { 
            top: insets.top + 10,
            opacity: slideUpAnim,
            transform: [{
              translateY: slideUpAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0]
              })
            }]
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.modeSelector}
          onPress={() => setShowModeSelector(true)}
        >
          <MaterialIcons name={currentMode.icon} size={20} color={currentMode.color} />
          <Text style={[styles.modeText, { color: currentMode.color }]}>
            {currentMode.name}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={20} color={currentMode.color} />
        </TouchableOpacity>

        <View style={styles.locationInfo}>
          <View style={styles.accuracyIndicator}>
            <MaterialIcons 
              name="gps-fixed" 
              size={14} 
              color={accuracy && accuracy < 20 ? '#4CAF50' : accuracy && accuracy < 50 ? '#FFC107' : '#F44336'} 
            />
            <Text style={styles.accuracyText}>
              {accuracy ? `${accuracy.toFixed(0)}m` : '--'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.mapTypeSelector}
            onPress={() => setShowMapSelector(true)}
          >
            <MaterialIcons name={currentMap.icon} size={16} color={currentMap.color} />
            <Text style={[styles.mapTypeText, { color: currentMap.color }]}>
              {currentMap.name}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* CONTROLES DO MAPA (FLUTUANTES) */}
      <View style={styles.mapControlsContainer}>
        <Animated.View 
          style={[
            styles.mapControls,
            { 
              right: 15,
              opacity: slideUpAnim,
              transform: [{
                translateY: slideUpAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0]
                })
              }]
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.mapControlButton}
            onPress={centerMap}
          >
            <MaterialIcons name="my-location" size={22} color="#2196F3" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.mapControlButton}
            onPress={rotateNorth}
          >
            <MaterialIcons name="explore" size={22} color="#2196F3" />
          </TouchableOpacity>
          
          <View style={styles.compassContainer}>
            <Animated.View style={[styles.compassNeedle, {
              transform: [{ rotate: `${compassHeading}deg` }]
            }]}>
              <MaterialIcons name="navigation" size={24} color="#F44336" />
            </Animated.View>
          </View>
        </Animated.View>
      </View>

      {/* FOOTER REORGANIZADO */}
      <Animated.View 
        style={[
          styles.footer,
          { 
            bottom: insets.bottom + 10,
            opacity: slideUpAnim,
            transform: [{
              translateY: slideUpAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0]
              })
            }]
          }
        ]}
      >
        {/* ESTATÍSTICAS (VISÍVEL APENAS NO MODO NAVEGAÇÃO E DURANTE CAMINHADA) */}
        {(walkMode === 'navigation' && isWalking) && (
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Distância</Text>
                <Text style={[styles.statValue, { color: currentMode.color }]}>
                  {(distance / 1000).toFixed(2)} km
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Tempo</Text>
                <Text style={[styles.statValue, { color: currentMode.color }]}>
                  {formatTime(duration)}
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Veloc.</Text>
                <Text style={[styles.statValue, { color: currentMode.color }]}>
                  {currentSpeed.toFixed(1)} km/h
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* CONTROLES PRINCIPAIS */}
        <View style={styles.controlsContainer}>
          {/* BOTÃO DE HISTÓRICO */}
          <TouchableOpacity 
            style={styles.historyButton}
            onPress={() => router.push('/history')}
          >
            <MaterialIcons name="history" size={22} color="#666" />
            {history.length > 0 && (
              <View style={styles.historyBadge}>
                <Text style={styles.historyBadgeText}>{history.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* BOTÕES PRINCIPAIS */}
          <View style={styles.mainControls}>
            {walkMode === 'navigation' ? (
              // CONTROLES PARA MODO NAVEGAÇÃO
              !isWalking ? (
                <TouchableOpacity 
                  style={[styles.startButton, { backgroundColor: currentMode.color }]}
                  onPress={startWalk}
                >
                  <MaterialIcons name="play-arrow" size={24} color="white" />
                  <Text style={styles.startButtonText}>INICIAR</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.walkControls}>
                  <TouchableOpacity 
                    style={[styles.controlButton, styles.pauseButton]}
                    onPress={pauseWalk}
                  >
                    <MaterialIcons 
                      name={isPaused ? "play-arrow" : "pause"} 
                      size={22} 
                      color="#FF9800" 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.controlButton, styles.stopButton]}
                    onPress={stopWalk}
                  >
                    <MaterialIcons name="stop" size={22} color="white" />
                  </TouchableOpacity>
                </View>
              )
            ) : (
              // CONTROLES PARA MODO EXPLORAÇÃO E FITNESS
              <View style={styles.exploreControls}>
                <TouchableOpacity 
                  style={[styles.exploreButton, { backgroundColor: currentMode.color }]}
                  onPress={() => {
                    if (walkMode === 'exploration') {
                      startExplorationWalk();
                    } else if (walkMode === 'fitness') {
                      setShowWorkoutPlans(true);
                    }
                  }}
                >
                  <MaterialIcons 
                    name={walkMode === 'exploration' ? "explore" : "fitness-center"} 
                    size={20} 
                    color="white" 
                  />
                  <Text style={styles.exploreButtonText}>
                    {walkMode === 'exploration' ? 'EXPLORAR' : 'TREINOS'}
                  </Text>
                </TouchableOpacity>
                
                {/* Botão adicional para modo fitness */}
                {walkMode === 'fitness' && (
                  <TouchableOpacity 
                    style={[styles.fitnessGoalButton, { backgroundColor: `${currentMode.color}80` }]}
                    onPress={() => setShowFitnessGoals(true)}
                  >
                    <MaterialIcons name="track-changes" size={16} color="white" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* BOTÃO DE INFORMAÇÕES DO MAPA */}
          <TouchableOpacity 
            style={styles.infoButton}
            onPress={() => setShowMapInfo(!showMapInfo)}
          >
            <MaterialIcons name="info" size={22} color="#666" />
          </TouchableOpacity>
        </View>

        {/* INFORMAÇÕES DO MAPA ATUAL (EXPANDÍVEL) */}
        {showMapInfo && (
          <Animated.View 
            style={[
              styles.mapInfoCard,
              {
                opacity: slideUpAnim,
                transform: [{
                  translateY: slideUpAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }]
              }
            ]}
          >
            <View style={styles.mapInfoHeader}>
              <View style={[styles.mapIcon, { backgroundColor: currentMap.color }]}>
                <MaterialIcons name={currentMap.icon} size={18} color="white" />
              </View>
              <View style={styles.mapInfoContent}>
                <Text style={styles.mapInfoTitle}>{currentMap.name}</Text>
                <Text style={styles.mapInfoDesc}>{currentMap.description}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMapInfo(false)}>
                <MaterialIcons name="close" size={18} color="#999" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.mapSettings}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Tráfego</Text>
                <Switch
                  value={showTraffic}
                  onValueChange={setShowTraffic}
                  trackColor={{ false: '#ddd', true: currentMap.color }}
                  thumbColor="#fff"
                />
              </View>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Pontos de interesse</Text>
                <Switch
                  value={showPOI}
                  onValueChange={setShowPOI}
                  trackColor={{ false: '#ddd', true: currentMap.color }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </Animated.View>
        )}
      </Animated.View>

      {/* MODAL SELETOR DE MAPA */}
      {showMapSelector && (
        <Animated.View 
          style={[
            styles.mapSelectorModal,
            { transform: [{ translateY: mapSelectorAnim }] }
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tipo de Mapa</Text>
            <TouchableOpacity onPress={() => setShowMapSelector(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.mapOptionsContainer}>
            {Object.entries(MAP_CONFIGS).map(([key, config]) => (
              <TouchableOpacity 
                key={key}
                style={[
                  styles.mapOption,
                  mapType === key && { borderColor: config.color, backgroundColor: `${config.color}10` }
                ]}
                onPress={() => changeMapType(key as MapType)}
              >
                <View style={[styles.mapOptionIcon, { backgroundColor: config.color }]}>
                  <MaterialIcons name={config.icon} size={22} color="white" />
                </View>
                <View style={styles.mapOptionContent}>
                  <Text style={styles.mapOptionTitle}>{config.name}</Text>
                  <Text style={styles.mapOptionDesc}>{config.description}</Text>
                  <View style={styles.mapOptionFeatures}>
                    {config.bestFor.slice(0, 2).map((feature, index) => (
                      <View key={index} style={styles.featureTag}>
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                {mapType === key && (
                  <MaterialIcons name="check-circle" size={22} color={config.color} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* MODAL SELETOR DE MODO */}
      {showModeSelector && (
        <Animated.View 
          style={[
            styles.modeSelectorModal,
            { transform: [{ translateY: modeSelectorAnim }] }
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Modo de Uso</Text>
            <TouchableOpacity onPress={() => setShowModeSelector(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modeOptionsContainer}>
            {Object.entries(WALK_MODES).map(([key, mode]) => (
              <TouchableOpacity 
                key={key}
                style={[
                  styles.modeOption,
                  walkMode === key && { borderColor: mode.color, backgroundColor: `${mode.color}10` }
                ]}
                onPress={() => changeWalkMode(key as WalkMode)}
              >
                <View style={[styles.modeIcon, { backgroundColor: mode.color }]}>
                  <MaterialIcons name={mode.icon} size={22} color="white" />
                </View>
                <View style={styles.modeContent}>
                  <Text style={styles.modeName}>{mode.name}</Text>
                  <Text style={styles.modeDesc}>{mode.description}</Text>
                </View>
                {walkMode === key && (
                  <MaterialIcons name="check-circle" size={22} color={mode.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Modal de Detalhes do POI */}
      {showPoiDetails && (
        <Animated.View style={[styles.poiModal, { bottom: 0 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ponto de Interesse</Text>
            <TouchableOpacity onPress={() => setShowPoiDetails(null)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          {(() => {
            const poi = pois.find(p => p.id === showPoiDetails);
            if (!poi) return null;
            
            return (
              <View style={styles.poiContent}>
                <View style={styles.poiHeader}>
                  <View style={[styles.poiCategory, { backgroundColor: currentMode.color }]}>
                    <MaterialIcons 
                      name={
                        poi.category === 'viewpoint' ? 'visibility' :
                        poi.category === 'natural' ? 'park' :
                        poi.category === 'historic' ? 'history' :
                        poi.category === 'restaurant' ? 'restaurant' :
                        'place'
                      } 
                      size={20} 
                      color="white" 
                    />
                  </View>
                  <View style={styles.poiInfo}>
                    <Text style={styles.poiName}>{poi.name}</Text>
                    <Text style={styles.poiDistance}>{poi.distance.toFixed(0)}m de distância</Text>
                  </View>
                  {poi.rating && (
                    <View style={styles.poiRating}>
                      <MaterialIcons name="star" size={16} color="#FFD700" />
                      <Text style={styles.ratingText}>{poi.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                
                {poi.description && (
                  <Text style={styles.poiDescription}>{poi.description}</Text>
                )}
                
                <View style={styles.poiActions}>
                  <TouchableOpacity 
                    style={styles.poiActionButton}
                    onPress={() => {
                      // Navegação para o POI
                      if (mapRef.current) {
                        mapRef.current.animateCamera({
                          center: poi.coords,
                          zoom: 18,
                        });
                      }
                    }}
                  >
                    <MaterialIcons name="navigation" size={18} color={currentMode.color} />
                    <Text style={[styles.poiActionText, { color: currentMode.color }]}>Navegar</Text>
                  </TouchableOpacity>
                  
                  {!poi.visited && (
                    <TouchableOpacity 
                      style={[styles.poiActionButton, styles.discoverButton]}
                      onPress={() => discoverPoi(poi.id)}
                    >
                      <MaterialIcons name="explore" size={18} color="white" />
                      <Text style={[styles.poiActionText, { color: 'white' }]}>Descobrir</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })()}
        </Animated.View>
      )}

      {/* Modal de Metas de Fitness */}
      {showFitnessGoals && (
        <Animated.View style={[styles.goalsModal, { transform: [{ translateY: modeSelectorAnim }] }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Metas de Fitness</Text>
            <TouchableOpacity onPress={() => setShowFitnessGoals(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.goalsContainer}>
            {fitnessGoals.map((goal, index) => (
              <View key={index} style={styles.goalItem}>
                <View style={styles.goalIcon}>
                  <MaterialIcons 
                    name={
                      goal.type === 'distance' ? 'directions-walk' :
                      goal.type === 'time' ? 'timer' :
                      goal.type === 'calories' ? 'local-fire-department' :
                      'footprint'
                    } 
                    size={20} 
                    color={goal.achieved ? '#4CAF50' : '#666'} 
                  />
                </View>
                <View style={styles.goalContent}>
                  <Text style={styles.goalName}>
                    {goal.type === 'distance' ? 'Distância' :
                     goal.type === 'time' ? 'Tempo' :
                     goal.type === 'calories' ? 'Calorias' : 'Passos'}
                  </Text>
                  <View style={styles.goalProgress}>
                    <View 
                      style={[
                        styles.goalProgressBar,
                        { 
                          width: `${Math.min(100, (goal.current / goal.target) * 100)}%`,
                          backgroundColor: goal.achieved ? '#4CAF50' : currentMode.color
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.goalText}>
                    {goal.current.toFixed(0)} / {goal.target} {goal.unit}
                    {goal.achieved && ' ✅'}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Modal de Planos de Treino */}
      {showWorkoutPlans && (
        <Animated.View style={[styles.workoutModal, { transform: [{ translateY: modeSelectorAnim }] }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Planos de Treino</Text>
            <TouchableOpacity onPress={() => setShowWorkoutPlans(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.workoutContainer}>
            {workoutPlans.map((plan) => (
              <TouchableOpacity 
                key={plan.id}
                style={[
                  styles.workoutItem,
                  plan.completed && styles.workoutCompleted,
                  selectedPlan?.id === plan.id && { borderColor: currentMode.color }
                ]}
                onPress={() => selectWorkoutPlan(plan)}
              >
                <View style={styles.workoutIcon}>
                  <MaterialIcons 
                    name={
                      plan.type === 'interval' ? 'repeat' :
                      plan.type === 'endurance' ? 'timer' :
                      plan.type === 'speed' ? 'speed' :
                      'self-improvement'
                    } 
                    size={24} 
                    color={plan.completed ? '#4CAF50' : currentMode.color} 
                  />
                </View>
                <View style={styles.workoutContent}>
                  <View style={styles.workoutHeader}>
                    <Text style={styles.workoutName}>{plan.name}</Text>
                    {plan.completed && (
                      <MaterialIcons name="check-circle" size={18} color="#4CAF50" />
                    )}
                  </View>
                  <Text style={styles.workoutDesc}>
                    {plan.type === 'interval' ? 'Treino intervalado' :
                     plan.type === 'endurance' ? 'Resistência' :
                     plan.type === 'speed' ? 'Velocidade' : 'Recuperação'}
                  </Text>
                  <Text style={styles.workoutDetails}>
                    {plan.duration} min • {plan.distance ? `${(plan.distance / 1000).toFixed(1)} km` : 'Intervalado'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Indicador de Treino Ativo (para modo Fitness) */}
      {activeWorkout && walkMode === 'fitness' && isWalking && (
        <View style={styles.activeWorkoutIndicator}>
          <View style={styles.workoutProgressBar}>
            <View 
              style={[
                styles.workoutProgressFill,
                { width: `${workoutProgress}%`, backgroundColor: currentMode.color }
              ]} 
            />
          </View>
          
          <View style={styles.workoutInfo}>
            <Text style={styles.workoutActiveName}>{activeWorkout.name}</Text>
            
            {activeWorkout.type === 'interval' && activeWorkout.intervals && (
              <View style={styles.intervalInfo}>
                <Text style={styles.intervalType}>
                  {activeWorkout.intervals[currentInterval].type === 'work' ? '🏃‍♂️ TRABALHO' : '🔄 DESCANSO'}
                </Text>
                <Text style={styles.intervalTime}>
                  {Math.floor(intervalTimeLeft / 60)}:{(intervalTimeLeft % 60).toString().padStart(2, '0')}
                </Text>
                <Text style={styles.intervalProgress}>
                  {currentInterval + 1}/{activeWorkout.intervals.length}
                </Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.cancelWorkoutButton}
            onPress={() => {
              Alert.alert(
                'Cancelar Treino',
                'Tem certeza que deseja cancelar o treino atual?',
                [
                  { text: 'Continuar' },
                  { 
                    text: 'Cancelar Treino', 
                    style: 'destructive',
                    onPress: () => {
                      setActiveWorkout(null);
                      cleanupWorkoutTimers();
                    }
                  },
                ]
              );
            }}
          >
            <MaterialIcons name="close" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  
  // Cabeçalho
  header: {
    position: 'absolute',
    left: 15,
    right: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 20,
    gap: 6,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  accuracyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accuracyText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  mapTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    borderRadius: 15,
    gap: 6,
  },
  mapTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Controles do mapa
  mapControlsContainer: {
    position: 'absolute',
    top: '50%',
    right: 0,
  },
  mapControls: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapControlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  compassContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  compassNeedle: {
    transformOrigin: 'center',
  },
  
  // Footer
  footer: {
    position: 'absolute',
    left: 15,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statsContainer: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  historyBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#2196F3',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mainControls: {
    flex: 1,
    alignItems: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  startButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  walkControls: {
    flexDirection: 'row',
    gap: 15,
    alignItems: 'center',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  pauseButton: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  stopButton: {
    backgroundColor: '#F44336',
    borderWidth: 2,
    borderColor: '#D32F2F',
  },
  exploreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  fitnessGoalButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  infoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  
  // Card de informações do mapa
  mapInfoCard: {
    marginTop: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  mapInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mapInfoContent: {
    flex: 1,
  },
  mapInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  mapInfoDesc: {
    fontSize: 12,
    color: '#666',
  },
  mapSettings: {
    gap: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 13,
    color: '#555',
  },
  
  // Modais
  mapSelectorModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: height * 0.7,
    paddingBottom: 30,
  },
  modeSelectorModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: height * 0.5,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  mapOptionsContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  mapOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mapOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  mapOptionContent: {
    flex: 1,
  },
  mapOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  mapOptionDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  mapOptionFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  featureTag: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  featureText: {
    fontSize: 10,
    color: '#555',
  },
  modeOptionsContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  modeContent: {
    flex: 1,
  },
  modeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 12,
    color: '#666',
  },
  
  // Marcadores
  currentMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(33, 150, 243, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  
  // Estilos para modo Exploração
  poiMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  poiMarkerVisited: {
    backgroundColor: '#4CAF50',
  },
  visitedBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#2196F3',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  areaMarker: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  areaMarkerText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: 'bold',
  },
  poiModal: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingBottom: 30,
    maxHeight: height * 0.5,
  },
  poiContent: {
    padding: 20,
  },
  poiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  poiCategory: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  poiInfo: {
    flex: 1,
  },
  poiName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  poiDistance: {
    fontSize: 14,
    color: '#666',
  },
  poiRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#FF8F00',
  },
  poiDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 20,
  },
  poiActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  poiActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginHorizontal: 5,
    gap: 8,
  },
  discoverButton: {
    backgroundColor: '#4CAF50',
  },
  poiActionText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Estilos para modo Fitness
  goalsModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: height * 0.6,
    paddingBottom: 30,
  },
  goalsContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    backgroundColor: '#f8f9fa',
  },
  goalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  goalContent: {
    flex: 1,
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  goalProgress: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  goalProgressBar: {
    height: '100%',
    borderRadius: 4,
  },
  goalText: {
    fontSize: 14,
    color: '#666',
  },
  workoutModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: height * 0.7,
    paddingBottom: 30,
  },
  workoutContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  workoutCompleted: {
    opacity: 0.7,
  },
  workoutIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  workoutContent: {
    flex: 1,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  workoutDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  workoutDetails: {
    fontSize: 12,
    color: '#888',
  },
  activeWorkoutIndicator: {
    position: 'absolute',
    top: 80,
    left: 15,
    right: 15,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  workoutProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 15,
  },
  workoutProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  workoutInfo: {
    flex: 2,
  },
  workoutActiveName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  intervalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  intervalType: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  intervalTime: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  intervalProgress: {
    fontSize: 10,
    color: '#999',
  },
  cancelWorkoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    marginLeft: 10,
  },
  
  // Tela de loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    color: '#333',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
});