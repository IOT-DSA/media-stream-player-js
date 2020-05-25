import React, {
  useState,
  forwardRef,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
  useRef,
} from 'react'

import { Container, Layer } from './Container'
import {
  PlaybackArea,
  AXIS_MEDIA_AMP,
  AXIS_IMAGE_CGI,
  VapixParameters,
  VideoProperties,
} from './PlaybackArea'
import { Controls } from './Controls'
import { Feedback } from './Feedback'
import { Sdp } from 'media-stream-library/dist/esm/utils/protocols'
import { Stats } from './Stats'
import { useSwitch } from './hooks/useSwitch'
import { MetadataHandler } from './metadata'
import styled from 'styled-components'

import debug from 'debug'
const debugLog = debug('msp:player');

const DEFAULT_API_TYPE = AXIS_MEDIA_AMP

/**
 * Wrapper for the entire player that will take up all available place from the
 * parent.
 */
const MediaStreamPlayerContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`

/**
 * The limiter prevents the video element to use up all of the available width.
 * The player container will automatically limit it's own height based on the
 * available width (keeping aspect ratio).
 */
const Limiter = styled.div`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`

interface PlayerProps {
  hostname: string
  vapixParams?: VapixParameters
  format?: Format
  autoPlay?: boolean
  onSdp?: (msg: Sdp) => void
  metadataHandler?: MetadataHandler
  aspectRatio?: number
  className?: string
}

export type PlayerNativeElement =
  | HTMLVideoElement
  | HTMLCanvasElement
  | HTMLImageElement

export type Format = 'H264' | 'MJPEG' | 'JPEG'

export const FORMAT_API = {
  H264: AXIS_MEDIA_AMP,
  MJPEG: AXIS_MEDIA_AMP,
  JPEG: AXIS_IMAGE_CGI,
}

export const Player = forwardRef<PlayerNativeElement, PlayerProps>(
  (
    {
      hostname,
      vapixParams = {},
      format,
      autoPlay,
      onSdp,
      metadataHandler,
      className,
    },
    ref,
  ) => {
    const [play, setPlay] = useState(autoPlay || false)
    const [refresh, setRefresh] = useState(0)
    const [host, setHost] = useState(hostname)
    const [waiting, setWaiting] = useState(autoPlay)
    const [api, setApi] = useState(
      format ? FORMAT_API[format] : DEFAULT_API_TYPE,
    )

    /**
     * VAPIX parameters
     */
    const [parameters, setParameters] = useState(vapixParams)
    window.localStorage.setItem('vapix', JSON.stringify(parameters))

    /**
     * Stats overlay
     */
    const [showStatsOverlay, toggleStatsOverlay] = useSwitch(
      window.localStorage.getItem('stats-overlay') === 'on',
    )
    window.localStorage.setItem(
      'stats-overlay',
      showStatsOverlay ? 'on' : 'off',
    )

    /**
     * Controls
     */

    const onPlayPause = useCallback(() => {
      debugLog(`Player: onPlayPause called: play: ${play}, hostname: "${hostname}"`);
      if (play) {
        setPlay(false)
      } else {
        setWaiting(true)
        setHost(hostname)
        setPlay(true)
      }
    }, [play, hostname])

    const onRefresh = useCallback(() => {
      setPlay(true)
      setRefresh((value) => value + 1)
      setWaiting(true)
    }, [])

    const onStop = useCallback(() => {
      setPlay(false)
      setHost('')
      setWaiting(false)
    }, [])

    const onFormat = (format: Format) => {
      switch (format) {
        case 'H264':
          setApi(AXIS_MEDIA_AMP)
          setParameters({ ...parameters, videocodec: 'h264' })
          break
        case 'MJPEG':
          setApi(AXIS_MEDIA_AMP)
          setParameters({ ...parameters, videocodec: 'jpeg' })
          break
        case 'JPEG':
          setApi(AXIS_IMAGE_CGI)
          break
        default:
        // no-op
      }
      setRefresh((value) => value + 1)
    }

    const onVapix = (key: string, value: string) => {
      setParameters((p: typeof vapixParams) => {
        if (value === '') {
          delete p[key]
          return { ...p }
        }

        return { ...p, [key]: value }
      })
      setRefresh((value) => value + 1)
    }

    /**
     * Aspect ratio
     *
     * This needs to be set so make the Container (and Layers) match the size of
     * the visible image of the video or still image.
     */

    const [videoProperties, setVideoProperties] = useState<VideoProperties>()
    const onPlaying = useCallback(
      (props: VideoProperties) => {
        setVideoProperties(props)
        setWaiting(false)
      },
      [setWaiting],
    )

    const naturalAspectRatio = useMemo(() => {
      if (videoProperties === undefined) {
        return undefined
      }
      const { width, height } = videoProperties
      return width / height
    }, [videoProperties])

    /**
     * Limit video size.
     *
     * The video size should not expand outside the available container, and
     * should be recomputed on resize.
     */

    const limiterRef = useRef<HTMLDivElement>(null)
    useLayoutEffect(() => {
      if (naturalAspectRatio === undefined || limiterRef.current === null) {
        return
      }

      const observer = new window.ResizeObserver(([entry]) => {
        const element = entry.target as HTMLElement
        const maxWidth = element.clientHeight * naturalAspectRatio
        element.style.maxWidth = `${maxWidth}px`
      })
      observer.observe(limiterRef.current)

      return () => observer.disconnect()
    }, [naturalAspectRatio])

    /**
     * Render
     *
     * Each layer is positioned exactly on top of the visible image, since the
     * aspect ratio is carried over to the container, and the layers match the
     * container size.
     *
     * There is a layer for the spinner (feedback), a statistics overlay, and a
     * control bar with play/pause/stop/refresh and a settings menu.
     */

    debugLog(`player - play: ${play} or ${autoPlay}, host: "${host}" or "${hostname}", params: `, parameters, "or: ", vapixParams);

    return (
      <MediaStreamPlayerContainer className={className}>
        <Limiter ref={limiterRef}>
          <Container aspectRatio={naturalAspectRatio}>
            <Layer>
              <PlaybackArea
                forwardedRef={ref}
                refresh={refresh}
                play={autoPlay}
                host={hostname}
                api={api}
                parameters={vapixParams}
                onPlaying={onPlaying}
                onSdp={onSdp}
                metadataHandler={metadataHandler}
              />
            </Layer>
            <Layer>
              <Feedback waiting={waiting} />
            </Layer>
            <Layer>
              {showStatsOverlay && videoProperties !== undefined ? (
                <Stats
                  api={api}
                  parameters={parameters}
                  videoProperties={videoProperties}
                  host={hostname}
                  open={showStatsOverlay}
                  refresh={refresh}
                />
              ) : null}
            </Layer>
            <Layer>
              <Controls
                play={autoPlay}
                src={hostname}
                parameters={vapixParams}
                onPlay={onPlayPause}
                onStop={onStop}
                onRefresh={onRefresh}
                onFormat={onFormat}
                onVapix={onVapix}
                labels={{
                  play: 'Play',
                  pause: 'Pause',
                  stop: 'Stop',
                  refresh: 'Refresh',
                  settings: 'Settings',
                }}
                showStatsOverlay={showStatsOverlay}
                toggleStats={toggleStatsOverlay}
              />
            </Layer>
          </Container>
        </Limiter>
      </MediaStreamPlayerContainer>
    )
  },
)

Player.displayName = 'Player'
