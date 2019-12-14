<template>
  <v-card
    :class="{
        'cursor-wait': !!loading
      }"
    :img="series.posterUrl"
    :to="route"
    class="anime-item anime-poster"
    height="314"
    v-if="!loading"
    width="225"
  >
    <v-container class="anime-title bottom-gradient white--text body-1" fluid>
      {{title}}
    </v-container>
  </v-card>
</template>

<script lang="ts">
  import {seriesStore} from '@/store/modules/series';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import {anime365Client} from '@/ApiClasses/Anime365Client';


  @Component
  export default class Anime extends Vue {
    @Prop(Number) public readonly malId!: number;

    loading = true;



    get series() {
      const seriesId = seriesStore.malMap[this.malId];
      return seriesStore.items[seriesId];
    }



    get title() {
      if (!this.series || !this.series.titles) {
        return '';
      }

      return this.series.titles.ru || this.series.titles.en || this.series.titles.romaji || this.series.titles.ja;
    }



    get route() {
      if (!this.series || !this.series.id) {
        return '';
      }

      return {
        name: 'player',
        params: {
          seriesId: this.series.id,
        },
      };
    }



    async created() {
      if (this.series) {
        this.loading = false;
        return;
      }

      if (!this.malId) {
        return;
      }

      try {
        const series = await anime365Client.getSeriesCollection({myAnimeListId: this.malId});
        series.forEach((s) => seriesStore.set(s));
      } finally {
        this.loading = false;
      }
    }

  }
</script>

<style scoped>
  .anime-poster {
    overflow: hidden;
    position: relative;
  }

  .anime-poster .anime-title {
    position: absolute;
    bottom: 0;
    background: linear-gradient(0deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.5) 40%, rgba(0, 0, 0, 0) 100%);
    padding-top: 20%;

    transform: translate(0, 100%);
    transition: transform 300ms;

    /*Свойство will-change: transform слиишком нагружает графику. Скролинг начинает фризить*/
    /*will-change: transform;*/
  }

  .anime-poster:hover .anime-title,
  .anime-poster:focus .anime-title {
    transform: translate(0, 0);
  }

</style>