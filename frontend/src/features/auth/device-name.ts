/** Best-effort human-readable device label from the user agent, e.g. "Chrome on Linux". */
export function defaultDeviceName(): string {
  const ua = navigator.userAgent
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('OPR/')
      ? 'Opera'
      : ua.includes('Chrome/')
        ? 'Chrome'
        : ua.includes('Firefox/')
          ? 'Firefox'
          : ua.includes('Safari/')
            ? 'Safari'
            : 'Browser'
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS'
  return `${browser} on ${os}`
}
