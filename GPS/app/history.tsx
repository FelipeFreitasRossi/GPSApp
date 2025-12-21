import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { removeWalk, clearHistory } from "@/store/walkSlice";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");

type SortType = "date" | "distance" | "duration" | "calories" | "speed" | "elevation";
type FilterMode = "all" | "walking" | "running" | "cycling" | "hiking";
type TimeFilter = "all" | "today" | "week" | "month";

// Funções de formatação
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    
    // Formatar para "dd/MM/yyyy às HH:mm"
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
};

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

const formatDistance = (meters: number) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

const formatElevation = (meters: number) => {
  return `${Math.round(meters)} m`;
};

const getModeIcon = (mode: string) => {
  switch (mode) {
    case 'walking': return 'directions-walk';
    case 'running': return 'directions-run';
    case 'cycling': return 'directions-bike';
    case 'hiking': return 'terrain';
    default: return 'directions-walk';
  }
};

const getModeColor = (mode: string) => {
  switch (mode) {
    case 'walking': return '#2196F3';
    case 'running': return '#E91E63';
    case 'cycling': return '#4CAF50';
    case 'hiking': return '#795548';
    default: return '#2196F3';
  }
};

const getModeLabel = (mode: string) => {
  switch (mode) {
    case 'walking': return 'Caminhada';
    case 'running': return 'Corrida';
    case 'cycling': return 'Ciclismo';
    case 'hiking': return 'Trilha';
    default: return 'Caminhada';
  }
};

export default function History() {
  const dispatch = useDispatch();
  const { history, stats } = useSelector((state: RootState) => state.walks);
  
  const [selectedWalk, setSelectedWalk] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<SortType>("date");
  const [sortDescending, setSortDescending] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [mapType, setMapType] = useState<"standard" | "hybrid" | "satellite">("standard");
  const [showStats, setShowStats] = useState(true);

  // Filtrar por modo de transporte
  const filteredByMode = useMemo(() => {
    if (filterMode === "all") return history;
    return history.filter(walk => walk.mode === filterMode);
  }, [history, filterMode]);

  // Filtrar por tempo
  const filteredByTime = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    return filteredByMode.filter(walk => {
      const walkDate = new Date(walk.date);
      const walkDateOnly = new Date(walkDate.getFullYear(), walkDate.getMonth(), walkDate.getDate());
      
      switch (timeFilter) {
        case "today":
          return walkDateOnly.getTime() === today.getTime();
        case "week":
          return walkDate >= weekAgo;
        case "month":
          return walkDate >= monthAgo;
        default:
          return true;
      }
    });
  }, [filteredByMode, timeFilter]);

  // Ordenar histórico
  const sortedHistory = useMemo(() => {
    const sorted = [...filteredByTime].sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case "distance":
          aValue = a.distance;
          bValue = b.distance;
          break;
        case "duration":
          aValue = a.duration;
          bValue = b.duration;
          break;
        case "calories":
          aValue = a.calories || 0;
          bValue = b.calories || 0;
          break;
        case "speed":
          aValue = a.maxSpeed;
          bValue = b.maxSpeed;
          break;
        case "elevation":
          aValue = (a.elevationGain || 0) + (a.elevationLoss || 0);
          bValue = (b.elevationGain || 0) + (b.elevationLoss || 0);
          break;
        default:
          return 0;
      }

      return sortDescending ? bValue - aValue : aValue - bValue;
    });

    return sorted;
  }, [filteredByTime, sortBy, sortDescending]);

  // Calcular estatísticas do filtro atual
  const filteredStats = useMemo(() => {
    const filtered = sortedHistory;
    
    if (filtered.length === 0) {
      return {
        totalDistance: 0,
        totalDuration: 0,
        totalCalories: 0,
        totalWalks: 0,
        averageDistance: 0,
        averageDuration: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        totalElevationGain: 0,
        totalElevationLoss: 0,
      };
    }

    const totalDistance = filtered.reduce((sum, walk) => sum + walk.distance, 0);
    const totalDuration = filtered.reduce((sum, walk) => sum + walk.duration, 0);
    const totalCalories = filtered.reduce((sum, walk) => sum + (walk.calories || 0), 0);
    const totalElevationGain = filtered.reduce((sum, walk) => sum + (walk.elevationGain || 0), 0);
    const totalElevationLoss = filtered.reduce((sum, walk) => sum + (walk.elevationLoss || 0), 0);
    const maxSpeed = Math.max(...filtered.map(walk => walk.maxSpeed || 0));
    const averageSpeed = filtered.reduce((sum, walk) => sum + (walk.avgSpeed || 0), 0) / filtered.length;

    return {
      totalDistance,
      totalDuration,
      totalCalories,
      totalWalks: filtered.length,
      averageDistance: totalDistance / filtered.length,
      averageDuration: totalDuration / filtered.length,
      averageSpeed,
      maxSpeed,
      totalElevationGain,
      totalElevationLoss,
    };
  }, [sortedHistory]);

  const handleDeleteWalk = (id: string) => {
    Alert.alert(
      "Excluir Caminhada",
      "Tem certeza que deseja excluir esta caminhada?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            dispatch(removeWalk(id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Limpar Histórico",
      "Tem certeza que deseja limpar todo o histórico?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar",
          style: "destructive",
          onPress: () => {
            dispatch(clearHistory());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleSort = (type: SortType) => {
    if (sortBy === type) {
      setSortDescending(!sortDescending);
    } else {
      setSortBy(type);
      setSortDescending(true);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openWalkDetails = (walk: any) => {
    setSelectedWalk(walk);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const renderModeFilter = () => (
    <View style={styles.filterContainer}>
      <Text style={styles.filterTitle}>Filtrar por Modo:</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        {[
          { key: "all", label: "Todos", icon: "filter-list" },
          { key: "walking", label: "Caminhada", icon: "directions-walk" },
          { key: "running", label: "Corrida", icon: "directions-run" },
          { key: "cycling", label: "Ciclismo", icon: "directions-bike" },
          { key: "hiking", label: "Trilha", icon: "terrain" },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterButton,
              filterMode === filter.key && { 
                backgroundColor: getModeColor(filter.key === 'all' ? 'walking' : filter.key),
                borderColor: getModeColor(filter.key === 'all' ? 'walking' : filter.key),
              },
            ]}
            onPress={() => {
              setFilterMode(filter.key as FilterMode);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <MaterialIcons
              name={filter.icon as any}
              size={16}
              color={filterMode === filter.key ? "white" : "#666"}
            />
            <Text
              style={[
                styles.filterButtonText,
                filterMode === filter.key && styles.filterButtonTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderTimeFilter = () => (
    <View style={styles.timeFilterContainer}>
      <Text style={styles.filterTitle}>Período:</Text>
      <View style={styles.timeFilterButtons}>
        {[
          { key: "all", label: "Todo Período" },
          { key: "today", label: "Hoje" },
          { key: "week", label: "7 Dias" },
          { key: "month", label: "30 Dias" },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.timeFilterButton,
              timeFilter === filter.key && styles.timeFilterButtonActive,
            ]}
            onPress={() => {
              setTimeFilter(filter.key as TimeFilter);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text
              style={[
                styles.timeFilterText,
                timeFilter === filter.key && styles.timeFilterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStatsCard = () => (
    <View style={styles.statsContainer}>
      <TouchableOpacity 
        style={styles.statsHeader}
        onPress={() => setShowStats(!showStats)}
        activeOpacity={0.7}
      >
        <View style={styles.statsTitleContainer}>
          <MaterialIcons name="bar-chart" size={24} color="#333" />
          <Text style={styles.statsTitle}>
            📊 Estatísticas {filterMode !== 'all' ? `(${getModeLabel(filterMode)})` : ''}
            {timeFilter !== 'all' ? ` - ${timeFilter === 'today' ? 'Hoje' : timeFilter === 'week' ? '7 Dias' : '30 Dias'}` : ''}
          </Text>
        </View>
        <MaterialIcons 
          name={showStats ? "expand-less" : "expand-more"} 
          size={24} 
          color="#666" 
        />
      </TouchableOpacity>
      
      {showStats && (
        <>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <MaterialIcons name="directions-walk" size={24} color="#2196F3" />
              <Text style={styles.statValue}>{filteredStats.totalWalks}</Text>
              <Text style={styles.statLabel}>Atividades</Text>
            </View>

            <View style={styles.statCard}>
              <MaterialIcons name="map" size={24} color="#4CAF50" />
              <Text style={styles.statValue}>
                {formatDistance(filteredStats.totalDistance)}
              </Text>
              <Text style={styles.statLabel}>Distância</Text>
            </View>

            <View style={styles.statCard}>
              <MaterialIcons name="timer" size={24} color="#FF9800" />
              <Text style={styles.statValue}>
                {formatDuration(filteredStats.totalDuration)}
              </Text>
              <Text style={styles.statLabel}>Tempo</Text>
            </View>

            <View style={styles.statCard}>
              <MaterialIcons name="local-fire-department" size={24} color="#F44336" />
              <Text style={styles.statValue}>
                {Math.round(filteredStats.totalCalories)}
              </Text>
              <Text style={styles.statLabel}>Calorias</Text>
            </View>
          </View>

          {filteredStats.totalElevationGain > 0 && (
            <View style={styles.elevationStats}>
              <View style={styles.elevationItem}>
                <MaterialIcons name="trending-up" size={20} color="#4CAF50" />
                <Text style={styles.elevationLabel}>Elevação +</Text>
                <Text style={styles.elevationValue}>
                  {formatElevation(filteredStats.totalElevationGain)}
                </Text>
              </View>
              
              <View style={styles.elevationItem}>
                <MaterialIcons name="trending-down" size={20} color="#F44336" />
                <Text style={styles.elevationLabel}>Elevação -</Text>
                <Text style={styles.elevationValue}>
                  {formatElevation(filteredStats.totalElevationLoss)}
                </Text>
              </View>
            </View>
          )}

          {/* Estatísticas globais */}
          {filterMode === 'all' && (
            <View style={styles.globalStats}>
              <Text style={styles.globalStatsTitle}>Distância por Modo:</Text>
              <View style={styles.modeStatsContainer}>
                <View style={styles.modeStatItem}>
                  <View style={[styles.modeIcon, { backgroundColor: '#2196F3' }]}>
                    <MaterialIcons name="directions-walk" size={16} color="white" />
                  </View>
                  <Text style={styles.modeStatText}>
                    {formatDistance(stats.walkingDistance)}
                  </Text>
                </View>
                
                <View style={styles.modeStatItem}>
                  <View style={[styles.modeIcon, { backgroundColor: '#E91E63' }]}>
                    <MaterialIcons name="directions-run" size={16} color="white" />
                  </View>
                  <Text style={styles.modeStatText}>
                    {formatDistance(stats.runningDistance)}
                  </Text>
                </View>
                
                <View style={styles.modeStatItem}>
                  <View style={[styles.modeIcon, { backgroundColor: '#4CAF50' }]}>
                    <MaterialIcons name="directions-bike" size={16} color="white" />
                  </View>
                  <Text style={styles.modeStatText}>
                    {formatDistance(stats.cyclingDistance)}
                  </Text>
                </View>
                
                <View style={styles.modeStatItem}>
                  <View style={[styles.modeIcon, { backgroundColor: '#795548' }]}>
                    <MaterialIcons name="terrain" size={16} color="white" />
                  </View>
                  <Text style={styles.modeStatText}>
                    {formatDistance(stats.hikingDistance)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderSortButtons = () => (
    <View style={styles.sortContainer}>
      <Text style={styles.sortTitle}>Ordenar por:</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.sortScroll}
      >
        {[
          { key: "date", label: "Data", icon: "calendar-today" },
          { key: "distance", label: "Distância", icon: "map" },
          { key: "duration", label: "Tempo", icon: "timer" },
          { key: "calories", label: "Calorias", icon: "local-fire-department" },
          { key: "speed", label: "Velocidade", icon: "speed" },
          { key: "elevation", label: "Elevação", icon: "terrain" },
        ].map((sort) => (
          <TouchableOpacity
            key={sort.key}
            style={[
              styles.sortButton,
              sortBy === sort.key && styles.sortButtonActive,
            ]}
            onPress={() => handleSort(sort.key as SortType)}
          >
            <MaterialIcons
              name={sort.icon as any}
              size={16}
              color={sortBy === sort.key ? "#2196F3" : "#666"}
            />
            <Text
              style={[
                styles.sortButtonText,
                sortBy === sort.key && styles.sortButtonTextActive,
              ]}
            >
              {sort.label}
            </Text>
            {sortBy === sort.key && (
              <MaterialIcons
                name={sortDescending ? "arrow-downward" : "arrow-upward"}
                size={14}
                color="#2196F3"
              />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderWalkItem = ({ item }: { item: any }) => {
    const modeColor = getModeColor(item.mode);
    
    return (
      <TouchableOpacity
        style={[styles.walkCard, { borderLeftColor: modeColor }]}
        onPress={() => openWalkDetails(item)}
        onLongPress={() => handleDeleteWalk(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.modeBadge, { backgroundColor: modeColor }]}>
              <MaterialIcons 
                name={getModeIcon(item.mode)} 
                size={16} 
                color="white" 
              />
            </View>
            <Text style={styles.modeText}>{getModeLabel(item.mode)}</Text>
          </View>
          
          <TouchableOpacity
            onPress={() => handleDeleteWalk(item.id)}
            style={styles.deleteButton}
          >
            <MaterialIcons name="delete-outline" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>

        <View style={styles.walkContent}>
          <View style={styles.dateContainer}>
            <MaterialIcons name="calendar-today" size={14} color="#666" />
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <MaterialIcons name="map" size={18} color="#2196F3" />
              <Text style={styles.statBoxValue}>{formatDistance(item.distance)}</Text>
              <Text style={styles.statBoxLabel}>Distância</Text>
            </View>

            <View style={styles.statBox}>
              <MaterialIcons name="timer" size={18} color="#FF9800" />
              <Text style={styles.statBoxValue}>{formatDuration(item.duration)}</Text>
              <Text style={styles.statBoxLabel}>Tempo</Text>
            </View>

            <View style={styles.statBox}>
              <MaterialIcons name="speed" size={18} color="#4CAF50" />
              <Text style={styles.statBoxValue}>
                {item.avgSpeed ? `${item.avgSpeed.toFixed(1)} km/h` : "--"}
              </Text>
              <Text style={styles.statBoxLabel}>Média</Text>
            </View>

            <View style={styles.statBox}>
              <MaterialIcons name="local-fire-department" size={18} color="#F44336" />
              <Text style={styles.statBoxValue}>
                {item.calories ? `${Math.round(item.calories)}` : "--"}
              </Text>
              <Text style={styles.statBoxLabel}>Cal</Text>
            </View>
          </View>

          {(item.elevationGain || item.elevationLoss) && (
            <View style={styles.elevationRow}>
              {item.elevationGain > 0 && (
                <View style={styles.elevationItemSmall}>
                  <MaterialIcons name="trending-up" size={14} color="#4CAF50" />
                  <Text style={styles.elevationTextSmall}>
                    +{formatElevation(item.elevationGain)}
                  </Text>
                </View>
              )}
              
              {item.elevationLoss > 0 && (
                <View style={styles.elevationItemSmall}>
                  <MaterialIcons name="trending-down" size={14} color="#F44336" />
                  <Text style={styles.elevationTextSmall}>
                    -{formatElevation(item.elevationLoss)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderWalkDetailsModal = () => {
    if (!selectedWalk) return null;
    
    const modeColor = getModeColor(selectedWalk.mode);
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes da Atividade</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailCard}>
                {/* Cabeçalho com modo e data */}
                <View style={styles.detailHeader}>
                  <View style={[styles.detailModeBadge, { backgroundColor: modeColor }]}>
                    <MaterialIcons 
                      name={getModeIcon(selectedWalk.mode)} 
                      size={20} 
                      color="white" 
                    />
                    <Text style={styles.detailModeText}>
                      {getModeLabel(selectedWalk.mode)}
                    </Text>
                  </View>
                  <Text style={styles.detailDate}>
                    {formatDate(selectedWalk.date)}
                  </Text>
                </View>

                {/* Estatísticas principais */}
                <View style={styles.mainStats}>
                  <View style={styles.mainStatItem}>
                    <MaterialIcons name="map" size={28} color="#2196F3" />
                    <Text style={styles.mainStatValue}>
                      {formatDistance(selectedWalk.distance)}
                    </Text>
                    <Text style={styles.mainStatLabel}>Distância</Text>
                  </View>

                  <View style={styles.mainStatItem}>
                    <MaterialIcons name="timer" size={28} color="#FF9800" />
                    <Text style={styles.mainStatValue}>
                      {formatDuration(selectedWalk.duration)}
                    </Text>
                    <Text style={styles.mainStatLabel}>Tempo</Text>
                  </View>
                </View>

                {/* Velocidade */}
                <View style={styles.speedStats}>
                  <View style={styles.speedStat}>
                    <MaterialIcons name="speed" size={24} color="#4CAF50" />
                    <Text style={styles.speedValue}>
                      {selectedWalk.avgSpeed ? `${selectedWalk.avgSpeed.toFixed(1)} km/h` : "--"}
                    </Text>
                    <Text style={styles.speedLabel}>Média</Text>
                  </View>

                  <View style={styles.speedStat}>
                    <MaterialIcons name="trending-up" size={24} color="#9C27B0" />
                    <Text style={styles.speedValue}>
                      {selectedWalk.maxSpeed ? `${selectedWalk.maxSpeed.toFixed(1)} km/h` : "--"}
                    </Text>
                    <Text style={styles.speedLabel}>Máxima</Text>
                  </View>
                </View>

                {/* Calorias e Elevação */}
                <View style={styles.extraStats}>
                  <View style={styles.extraStatCard}>
                    <MaterialIcons name="local-fire-department" size={24} color="#F44336" />
                    <View style={styles.extraStatContent}>
                      <Text style={styles.extraStatValue}>
                        {selectedWalk.calories ? `${Math.round(selectedWalk.calories)} cal` : "--"}
                      </Text>
                      <Text style={styles.extraStatLabel}>Calorias Queimadas</Text>
                    </View>
                  </View>

                  {(selectedWalk.elevationGain || selectedWalk.elevationLoss) && (
                    <View style={styles.elevationCard}>
                      <View style={styles.elevationStat}>
                        <MaterialIcons name="trending-up" size={20} color="#4CAF50" />
                        <Text style={styles.elevationLabel}>
                          Ganho: {formatElevation(selectedWalk.elevationGain || 0)}
                        </Text>
                      </View>
                      <View style={styles.elevationStat}>
                        <MaterialIcons name="trending-down" size={20} color="#F44336" />
                        <Text style={styles.elevationLabel}>
                          Perda: {formatElevation(selectedWalk.elevationLoss || 0)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Mapa do trajeto */}
                {selectedWalk.route && selectedWalk.route.length > 1 && (
                  <>
                    <Text style={styles.sectionTitle}>Trajeto Percorrido</Text>
                    <View style={styles.fullMapContainer}>
                      <MapView
                        style={styles.fullMap}
                        provider={PROVIDER_GOOGLE}
                        mapType={mapType}
                        initialRegion={{
                          latitude: selectedWalk.route[0].latitude,
                          longitude: selectedWalk.route[0].longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }}
                      >
                        <Polyline
                          coordinates={selectedWalk.route}
                          strokeWidth={4}
                          strokeColor={modeColor}
                        />
                        <Marker coordinate={selectedWalk.route[0]} title="Início">
                          <View style={[styles.detailMarker, { backgroundColor: "#4CAF50" }]} />
                        </Marker>
                        <Marker
                          coordinate={selectedWalk.route[selectedWalk.route.length - 1]}
                          title="Fim"
                        >
                          <View style={[styles.detailMarker, { backgroundColor: "#F44336" }]} />
                        </Marker>
                      </MapView>

                      <View style={styles.mapControls}>
                        <TouchableOpacity
                          style={styles.mapTypeButton}
                          onPress={() =>
                            setMapType(
                              mapType === "standard"
                                ? "satellite"
                                : mapType === "satellite"
                                ? "hybrid"
                                : "standard"
                            )
                          }
                        >
                          <MaterialIcons
                            name={
                              mapType === "standard"
                                ? "map"
                                : mapType === "satellite"
                                ? "satellite"
                                : "layers"
                            }
                            size={20}
                            color="#2196F3"
                          />
                          <Text style={styles.mapTypeText}>
                            {mapType === "standard"
                              ? "Padrão"
                              : mapType === "satellite"
                              ? "Satélite"
                              : "Híbrido"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                {/* Informações técnicas */}
                <View style={styles.technicalInfo}>
                  <Text style={styles.sectionTitle}>Informações Técnicas</Text>
                  <View style={styles.technicalGrid}>
                    <View style={styles.techItem}>
                      <Text style={styles.techLabel}>Pontos Registrados</Text>
                      <Text style={styles.techValue}>
                        {selectedWalk.points || selectedWalk.route?.length || 0}
                      </Text>
                    </View>
                    <View style={styles.techItem}>
                      <Text style={styles.techLabel}>Precisão Média</Text>
                      <Text style={styles.techValue}>
                        {selectedWalk.accuracy
                          ? `${selectedWalk.accuracy.toFixed(0)} m`
                          : "--"}
                      </Text>
                    </View>
                    <View style={styles.techItem}>
                      <Text style={styles.techLabel}>ID da Atividade</Text>
                      <Text style={styles.techValue} numberOfLines={1} ellipsizeMode="middle">
                        {selectedWalk.id.substring(0, 8)}...
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={() => {
                  handleDeleteWalk(selectedWalk.id);
                  setModalVisible(false);
                }}
              >
                <MaterialIcons name="delete" size={20} color="white" />
                <Text style={styles.deleteButtonText}>Excluir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.shareButton]}
                onPress={() => {
                  Alert.alert("Em breve!", "Funcionalidade de compartilhamento em desenvolvimento.");
                }}
              >
                <MaterialIcons name="share" size={20} color="#2196F3" />
                <Text style={styles.shareButtonText}>Compartilhar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.closeModalButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeModalButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (history.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="history-toggle-off" size={80} color="#666" />
          <Text style={styles.emptyTitle}>Nenhuma atividade registrada</Text>
          <Text style={styles.emptyText}>
            Comece uma nova caminhada, corrida, pedalada ou trilha para ver seu histórico aqui
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 Histórico de Atividades</Text>
        {sortedHistory.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearHistory}
          >
            <MaterialIcons name="delete-sweep" size={24} color="#F44336" />
          </TouchableOpacity>
        )}
      </View>

      {renderModeFilter()}
      {renderTimeFilter()}
      {renderStatsCard()}
      {renderSortButtons()}

      <FlatList
        data={sortedHistory}
        keyExtractor={(item) => item.id}
        renderItem={renderWalkItem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#2196F3"]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.noResultsContainer}>
            <MaterialIcons name="search-off" size={60} color="#999" />
            <Text style={styles.noResultsText}>
              Nenhuma atividade encontrada com os filtros atuais
            </Text>
          </View>
        }
      />

      {renderWalkDetailsModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  clearButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  filterContainer: {
    backgroundColor: "white",
    marginHorizontal: 15,
    marginTop: 10,
    padding: 15,
    borderRadius: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  timeFilterContainer: {
    backgroundColor: "white",
    marginHorizontal: 15,
    marginTop: 10,
    padding: 15,
    borderRadius: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 10,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f8f9fa",
    marginRight: 10,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  filterButtonTextActive: {
    color: "white",
    fontWeight: "600",
  },
  timeFilterButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  timeFilterButtonActive: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  timeFilterText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  timeFilterTextActive: {
    color: "#2196F3",
    fontWeight: "600",
  },
  statsContainer: {
    backgroundColor: "white",
    margin: 15,
    borderRadius: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: "hidden",
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#f8f9fa",
  },
  statsTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 20,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  elevationStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  elevationItem: {
    alignItems: "center",
  },
  elevationLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  elevationValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginTop: 2,
  },
  globalStats: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  globalStatsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 10,
  },
  modeStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modeStatItem: {
    alignItems: "center",
    flex: 1,
  },
  modeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  modeStatText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  sortContainer: {
    backgroundColor: "white",
    marginHorizontal: 15,
    marginTop: 10,
    padding: 15,
    borderRadius: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  sortTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 10,
  },
  sortScroll: {
    flexGrow: 0,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f8f9fa",
    marginRight: 10,
    gap: 6,
  },
  sortButtonActive: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  sortButtonText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  sortButtonTextActive: {
    color: "#2196F3",
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  noResultsContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 20,
  },
  walkCard: {
    backgroundColor: "white",
    borderRadius: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: "hidden",
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  deleteButton: {
    padding: 5,
  },
  walkContent: {
    padding: 20,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 15,
  },
  dateText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  statBox: {
    width: "48%",
    alignItems: "center",
    marginBottom: 15,
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginTop: 4,
  },
  statBoxLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  elevationRow: {
    flexDirection: "row",
    gap: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  elevationItemSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  elevationTextSmall: {
    fontSize: 12,
    color: "#666",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: height * 0.9,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  deleteButton: {
    backgroundColor: "#F44336",
  },
  deleteButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  shareButton: {
    backgroundColor: "#E3F2FD",
    borderWidth: 1,
    borderColor: "#2196F3",
  },
  shareButtonText: {
    color: "#2196F3",
    fontSize: 14,
    fontWeight: "600",
  },
  closeModalButton: {
    backgroundColor: "#f0f0f0",
  },
  closeModalButtonText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
  },
  detailCard: {
    paddingVertical: 20,
  },
  detailHeader: {
    alignItems: "center",
    marginBottom: 25,
  },
  detailModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 10,
  },
  detailModeText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  detailDate: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  mainStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 25,
  },
  mainStatItem: {
    alignItems: "center",
    flex: 1,
  },
  mainStatValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  mainStatLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  speedStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 25,
  },
  speedStat: {
    alignItems: "center",
    flex: 1,
  },
  speedValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  speedLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  extraStats: {
    marginBottom: 25,
  },
  extraStatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    gap: 15,
  },
  extraStatContent: {
    flex: 1,
  },
  extraStatValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#E65100",
  },
  extraStatLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  elevationCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#F5F5F5",
    padding: 15,
    borderRadius: 15,
  },
  elevationStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  elevationLabel: {
    fontSize: 14,
    color: "#666",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 15,
  },
  fullMapContainer: {
    height: 250,
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 25,
  },
  fullMap: {
    ...StyleSheet.absoluteFillObject,
  },
  detailMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "white",
  },
  mapControls: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapTypeText: {
    fontSize: 12,
    color: "#2196F3",
    fontWeight: "500",
  },
  technicalInfo: {
    backgroundColor: "#f8f9fa",
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  technicalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  techItem: {
    width: "48%",
    marginBottom: 15,
  },
  techLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  techValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
});