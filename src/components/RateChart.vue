<template>
  <div ref="el" class="chart-box"></div>
  
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  data: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  base: { type: String, default: 'TWD' },
  quote: { type: String, default: 'JPY' },
  showStats: { type: Boolean, default: true },
  // Optional overlay series
  overlay: { type: Object, default: null }, // { name: 'USD/JPY', data: number[] aligned by date }
  useSecondaryAxis: { type: Boolean, default: false },
  // Moving averages aligned arrays
  ma7: { type: Array, default: () => [] },
  ma30: { type: Array, default: () => [] },
})

const el = ref(null)
let chart

function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)

  const dates = props.data.map(d => d.date)
  const values = props.data.map(d => d.value)

  const legend = [ `${props.base}/${props.quote}` ]
  if (props.overlay?.name && props.overlay?.data?.length) legend.push(props.overlay.name)
  if (props.ma7?.length) legend.push('MA7')
  if (props.ma30?.length) legend.push('MA30')

  const yAxes = [{ type: 'value', scale: true, name: `${props.base}/${props.quote}` }]
  if (props.overlay && props.useSecondaryAxis) {
    yAxes.push({ type: 'value', scale: true, name: props.overlay.name, position: 'right' })
  }

  const series = [
    {
      name: `${props.base}/${props.quote}`,
      type: 'line',
      data: values,
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.08 },
      markPoint: props.showStats ? { data: [ { type: 'max', name: '最高' }, { type: 'min', name: '最低' } ] } : undefined,
      markLine: props.showStats ? { data: [ { type: 'average', name: '平均' } ] } : undefined,
    },
  ]

  if (props.overlay?.data?.length) {
    series.push({
      name: props.overlay.name,
      type: 'line',
      data: props.overlay.data,
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2 },
      yAxisIndex: props.useSecondaryAxis ? 1 : 0,
    })
  }

  if (props.ma7?.length) {
    series.push({ name: 'MA7', type: 'line', data: props.ma7, smooth: true, showSymbol: false, lineStyle: { width: 1, type: 'dashed' } })
  }
  if (props.ma30?.length) {
    series.push({ name: 'MA30', type: 'line', data: props.ma30, smooth: true, showSymbol: false, lineStyle: { width: 1, type: 'dashed' } })
  }

  chart.setOption({
    title: { text: props.title, left: 'center' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const header = params[0]?.axisValue || ''
        const lines = params.map(p => {
          const val = p.data == null ? '-' : Number(p.data).toFixed(4)
          return `${p.marker}${p.seriesName}: ${val}`
        })
        return [header, ...lines].join('<br/>')
      }
    },
    legend: { data: legend, top: 28 },
    grid: { left: 40, right: 40, top: 60, bottom: 40 },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: yAxes,
    series,
  })
  chart.resize()
}

watch(() => props.data, render, { deep: true })

function handleResize() { chart && chart.resize() }

onMounted(() => {
  render()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (chart) { chart.dispose(); chart = null }
})

function getDataURL() {
  if (!chart) return ''
  return chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
}

function saveAsPNG(filename = 'chart.png') {
  const url = getDataURL()
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

defineExpose({ getDataURL, saveAsPNG })
</script>

<style scoped>
.chart-box { width: 100%; height: 420px; }
</style>
