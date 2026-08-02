'use client'; import {create} from 'zustand'; import {JourneySearchValues} from '@/schemas/journey-search.schema';
interface State{recent:JourneySearchValues|null;setRecent:(value:JourneySearchValues)=>void} export const useJourneySearchStore=create<State>(set=>({recent:null,setRecent:recent=>set({recent})}));
