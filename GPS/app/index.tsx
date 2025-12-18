// app/index.tsx - VERSÃO REORGANIZADA E OTIMIZADA
import { addWalk } from "../store/walkSlice";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import haversine from "haversine";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  useColorScheme,
  View,
  TouchableOpacity,
  Animated,
  Platform,
  Modal,
  ScrollView,
  Dimensions,
  Switch,
  PanResponder,
} from "react-native";
import "react-native-get-random-values";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import { RootState } from "../store";
import { MaterialIcons, FontAwesome5, Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get('window');

interface WalkPoint {
  coords: Location.LocationObjectCoords;
  timestamp: number;
  speed?: number;
  altitude?: number;
}

type MapType = 'standard' | 'satellite' | 'hybrid';
type WalkMode = 'navigation' | 'exploration' | 'fitness';

interface MapConfig {
  name: string;
  icon: string;
  description: string;
  color: string;
  features: string[];
  bestFor: string[];
}

const MAP_CONFIGS: Record<MapType, MapConfig> = {
  standard: {
    name: 'Padrão',
    icon: 'map',
    description: 'Mapa tradicional com ruas detalhadas',
    color: '#4285F4',
    features: ['Rotas detalhadas', 'Nomes de ruas', 'Tráfego em tempo real'],
    bestFor: ['Navegação urbana', 'Encontrar endereços', 'Planejar rotas']
  },
  satellite: {
    name: 'Satélite',
    icon: 'satellite',
    description: 'Imagens reais de satélite em alta resolução',
    color: '#34A853',
    features: ['Imagens aéreas', 'Detalhes do terreno', 'Pontos de referência'],
    bestFor: ['Explorar áreas naturais', 'Identificar locais', 'Ver edificações']
  },
  hybrid: {
    name: 'Híbrido',
    icon: 'layers',
    description: 'Combina imagens de satélite com informações de ruas',
    color: '#FBBC05',
    features: ['Visual realista', 'Ruas sobrepostas', 'Melhor contexto'],
    bestFor: ['Novas áreas', 'Contexto visual', 'Orientação espacial']
  }
};

const WALK_MODES = {
  navigation: {
    name: 'Navegação',
    icon: 'navigation',
    color: '#2196F3',
    description: 'Rastreie rotas e distâncias'
  },
  exploration: {
    name: 'Exploração',
    icon: 'explore',
    color: '#4CAF50',
    description: 'Descubra novos lugares'
  },
  fitness: {
    name: 'Fitness',
    icon: 'directions-run',
    color: '#FF5722',
    description: 'Acompanhe exercícios'
  }
};

export default function WalkApp() {
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [route, setRoute] = useState<WalkPoint[]>([]);
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
  
  const watchId = useRef<Location.LocationSubscription>(null);
  const mapRef = useRef<MapView>(null);
  const timerRef = useRef<NodeJS.Timeout>();
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
    startCompass();
    return () => {
      cleanup();
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
    if (Location.hasServicesEnabledAsync()) {
      // Simulação simplificada de bússola
      setInterval(() => {
        setCompassHeading(prev => (prev + 0.5) % 360);
      }, 100);
    }
  };

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

    const newPoint: WalkPoint = {
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
          lastPoint.coords,
          newLocation.coords,
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
    setIsPaused(!isPaused);
    
    if (isPaused) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
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
    }
    
    if (watchId.current) {
      watchId.current.remove();
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
        mode: 'walking',
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
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
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
                    // Ação para modo exploração/fitness
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                >
                  <MaterialIcons name="explore" size={20} color="white" />
                  <Text style={styles.exploreButtonText}>
                    {walkMode === 'exploration' ? 'EXPLORAR' : 'FITNESS'}
                  </Text>
                </TouchableOpacity>
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

      {/* MODAL SELETOR DE MODO */}
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

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

const lightMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dadada"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#c9c9c9"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  }
];