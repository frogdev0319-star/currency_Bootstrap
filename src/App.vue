<template>
  <div class="container">
    <div class="header">
      <h2>日圓走勢分析</h2>
      <span class="badge bg-secondary">Vue + Vite · Bootstrap 5 · ECharts</span>
    </div>

    <div class="toolbar">
      <div class="btn-group btn-group-sm" role="group">
        <input type="radio" class="btn-check" id="preset-today" value="today" v-model="preset" @change="onPresetChange">
        <label class="btn btn-outline-primary" for="preset-today">本日</label>
        
        <input type="radio" class="btn-check" id="preset-3d" value="3d" v-model="preset" @change="onPresetChange">
        <label class="btn btn-outline-primary" for="preset-3d">三日內</label>
        
        <input type="radio" class="btn-check" id="preset-7d" value="7d" v-model="preset" @change="onPresetChange">
        <label class="btn btn-outline-primary" for="preset-7d">一週</label>
        
        <input type="radio" class="btn-check" id="preset-30d" value="30d" v-model="preset" @change="onPresetChange">
        <label class="btn btn-outline-primary" for="preset-30d">一個月</label>
      </div>

      <div class="d-flex gap-2 align-items-center">
        <input 
          type="date" 
          class="form-control form-control-sm" 
          v-model="startDate"
          :max="maxDate"
          @change="onDateChange"
          style="width: 140px"
        />
        <span>至</span>
        <input 
          type="date" 
          class="form-control form-control-sm" 
          v-model="endDate"
          :max="maxDate"
          @change="onDateChange"
          style="width: 140px"
        />
      </div>

      <div class="btn-group btn-group-sm" role="group">
        <input type="radio" class="btn-check" id="pair-twd" value="TWD/JPY" v-model="pair" @change="onPairChange">
        <label class="btn btn-outline-primary" for="pair-twd">TWD/JPY</label>
        
        <input type="radio" class="btn-check" id="pair-jpy" value="JPY/TWD" v-model="pair" @change="onPairChange">
        <label class="btn btn-outline-primary" for="pair-jpy">JPY/TWD</label>
      </div>

      <select v-model="overlayPair" class="form-select form-select-sm" style="width: 160px">
        <option value="">無對照</option>
        <option value="USD/JPY">USD/JPY</option>
        <option value="EUR/JPY">EUR/JPY</option>
        <option value="CNY/JPY">CNY/JPY</option>
      </select>

      <div class="form-check form-switch">
        <input 
          class="form-check-input" 
          type="checkbox" 
          id="secondaryAxis"
          v-model="useSecondaryAxis"
          :disabled="!overlayPair"
        />
        <label class="form-check-label" for="secondaryAxis">次軸</label>
      </div>

      <div class="form-check form-switch">
        <input 
          class="form-check-input" 
          type="checkbox" 
          id="autoRefresh"
          v-model="autoRefresh"
          :disabled="preset !== 'today'"
        />
        <label class="form-check-label" for="autoRefresh">自動更新</label>
      </div>

      <select 
        v-model="autoInterval" 
        class="form-select form-select-sm"
        :disabled="!autoRefresh || preset !== 'today'"
        style="width: 100px"
      >
        <option :value="1">1 分</option>
        <option :value="5">5 分</option>
        <option :value="15">15 分</option>
      </select>

      <button class="btn btn-sm btn-outline-secondary" @click="exportCSV" :disabled="!series.length">
        匯出 CSV
      </button>
      <button class="btn btn-sm btn-primary" @click="exportPNG" :disabled="!series.length">
        匯出 PNG
      </button>
    </div>

    <div class="metrics" v-if="series.length">
      <span class="badge bg-success fs-6">
        當前匯率：1 {{ base }} = {{ latestValue.toFixed(4) }} {{ quote }}
      </span>
      <span :class="deltaClass">
        (較區間起點 {{ deltaPrefix }}{{ Math.abs(delta).toFixed(3) }}，
        {{ deltaPrefix }}{{ Math.abs(deltaPct).toFixed(2) }}%)
      </span>
    </div>

    <div class="chart-card position-relative">
      <div v-if="loading || overlayLoading" class="loading-overlay">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">載入中...</span>
        </div>
      </div>
      <RateChart
        ref="chartRef"
        :data="series"
        :title="chartTitle"
        :base="base"
        :quote="quote"
        :show-stats="true"
        :overlay="overlay"
        :use-secondary-axis="useSecondaryAxis"
        :ma7="ma7"
        :ma30="ma30"
      />
    </div>

    <!-- Toast Container -->
    <div class="toast-container position-fixed bottom-0 end-0 p-3">
      <div 
        ref="toastEl"
        class="toast align-items-center text-white border-0"
        :class="toastClass"
        role="alert"
      >
        <div class="d-flex">
          <div class="toast-body">{{ toastMessage }}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import dayjs from "dayjs";
import RateChart from "./components/RateChart.vue";
import { getPairRates } from "./services/rates";

// Bootstrap Toast
let bsToast = null;
const toastEl = ref(null);
const toastMessage = ref('');
const toastClass = ref('bg-danger');

function showToast(message, type = 'error') {
  toastMessage.value = message;
  toastClass.value = type === 'error' ? 'bg-danger' : 'bg-success';
  
  if (toastEl.value && typeof bootstrap !== 'undefined') {
    if (!bsToast) {
      bsToast = new bootstrap.Toast(toastEl.value);
    }
    bsToast.show();
  }
}

const today = () => dayjs().startOf("day");
const maxDate = today().format('YYYY-MM-DD');

const preset = ref("7d");
const startDate = ref(today().subtract(6, "day").format('YYYY-MM-DD'));
const endDate = ref(today().format('YYYY-MM-DD'));

const range = computed({
  get: () => [new Date(startDate.value), new Date(endDate.value)],
  set: ([start, end]) => {
    startDate.value = dayjs(start).format('YYYY-MM-DD');
    endDate.value = dayjs(end).format('YYYY-MM-DD');
  }
});

function onPresetChange() {
  switch (preset.value) {
    case "today":
      startDate.value = today().format('YYYY-MM-DD');
      endDate.value = today().format('YYYY-MM-DD');
      break;
    case "3d":
      startDate.value = today().subtract(2, "day").format('YYYY-MM-DD');
      endDate.value = today().format('YYYY-MM-DD');
      break;
    case "7d":
      startDate.value = today().subtract(6, "day").format('YYYY-MM-DD');
      endDate.value = today().format('YYYY-MM-DD');
      break;
    case "30d":
      startDate.value = today().subtract(29, "day").format('YYYY-MM-DD');
      endDate.value = today().format('YYYY-MM-DD');
      break;
  }
}

function onDateChange() {
  // Sync preset based on date selection
  const start = dayjs(startDate.value);
  const end = dayjs(endDate.value);
  const days = end.diff(start, "day");
  const map = { 0: "today", 2: "3d", 6: "7d", 29: "30d" };
  preset.value = map[days] || "";
}

const pair = ref("TWD/JPY");
const base = computed(() => pair.value.split("/")[0]);
const quote = computed(() => pair.value.split("/")[1]);
const chartTitle = computed(() => `${base.value}/${quote.value} 匯率折線圖`);
const series = ref([]);
const loading = ref(false);
const overlayPair = ref("");
const overlay = ref(null);
const overlayLoading = ref(false);
const useSecondaryAxis = ref(false);
const autoRefresh = ref(true);
const autoInterval = ref(5); // minutes
let timer = null;

async function load() {
  if (!startDate.value || !endDate.value) return;
  loading.value = true;
  try {
    series.value = await getPairRates(base.value, quote.value, new Date(startDate.value), new Date(endDate.value));
  } catch (e) {
    console.error(e);
    series.value = [];
    showToast("取得匯率資料失敗，請稍後重試", 'error');
  } finally {
    loading.value = false;
  }
}

async function loadOverlay() {
  overlay.value = null;
  if (!overlayPair.value) return;
  if (!startDate.value || !endDate.value) return;
  overlayLoading.value = true;
  const [b, q] = overlayPair.value.split("/");
  try {
    const data = await getPairRates(b, q, new Date(startDate.value), new Date(endDate.value));
    const mainDates = series.value.map((d) => d.date);
    const map = new Map(data.map((d) => [d.date, d.value]));
    const aligned = mainDates.length
      ? mainDates.map((d) => map.get(d) ?? null)
      : data.map((d) => d.value);
    overlay.value = { name: overlayPair.value, data: aligned };
  } catch (e) {
    console.error(e);
    overlay.value = null;
    showToast("取得對照幣別資料失敗", 'error');
  } finally {
    overlayLoading.value = false;
  }
}

watch([startDate, endDate], () => {
  load();
  loadOverlay();
});
watch(pair, load);
watch(overlayPair, loadOverlay);

onMounted(() => {
  load();
  loadOverlay();
});

const latestValue = computed(() =>
  series.value.length ? series.value[series.value.length - 1].value : 0
);
const firstValue = computed(() =>
  series.value.length ? series.value[0].value : 0
);
const delta = computed(() => latestValue.value - firstValue.value);
const deltaPct = computed(() =>
  firstValue.value ? (delta.value / firstValue.value) * 100 : 0
);
const deltaClass = computed(() =>
  delta.value >= 0 ? "delta-up" : "delta-down"
);
const deltaPrefix = computed(() => (delta.value >= 0 ? "+" : "-"));

function onPairChange() {
  load();
}

const chartRef = ref(null);

function exportCSV() {
  if (!series.value.length) return;
  const includeOverlay = !!overlay.value;
  const header = `date,${base.value}/${quote.value},MA7,MA30${
    includeOverlay ? "," + overlay.value.name : ""
  }\n`;
  const rows = series.value.map((d, i) => {
    const cols = [d.date, d.value, ma7.value[i] ?? "", ma30.value[i] ?? ""];
    if (includeOverlay) cols.push(overlay.value.data[i] ?? "");
    return cols.join(",");
  });
  const csv = header + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base.value}-${quote.value}-${dayjs(startDate.value).format(
    "YYYYMMDD"
  )}_${dayjs(endDate.value).format("YYYYMMDD")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPNG() {
  chartRef.value?.saveAsPNG(`${base.value}-${quote.value}.png`);
}

function startTimer() {
  stopTimer();
  if (preset.value !== "today" || !autoRefresh.value) return;
  const ms = autoInterval.value * 60 * 1000;
  timer = setInterval(() => {
    load();
    loadOverlay();
  }, ms);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch([preset, autoRefresh, autoInterval], startTimer);
onMounted(startTimer);
onBeforeUnmount(stopTimer);

// helpers for moving averages
function sma(arr, window) {
  const res = new Array(arr.length).fill(null);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= window) sum -= arr[i - window];
    if (i >= window - 1) res[i] = Number((sum / window).toFixed(6));
  }
  return res;
}
const valuesOnly = computed(() => series.value.map((d) => d.value));
const ma7 = computed(() => sma(valuesOnly.value, 7));
const ma30 = computed(() => sma(valuesOnly.value, 30));
</script>

<style scoped>
h2 {
  margin: 0;
  font-weight: 600;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  border-radius: 8px;
}
</style>
