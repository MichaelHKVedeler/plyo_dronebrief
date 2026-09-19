// SunCalc 1.9, also used by the existing ShadeMap adapter. Times can be Invalid
// Date at polar latitudes; the sunlight adapter validates every event.
declare module 'suncalc' {
  const SunCalc: {
    getTimes(date: Date, latitude: number, longitude: number, height?: number): Record<string, Date>
    getPosition(date: Date, latitude: number, longitude: number): { altitude: number; azimuth: number }
    addTime(angle: number, morningName: string, eveningName: string): void
  }
  export default SunCalc
}
