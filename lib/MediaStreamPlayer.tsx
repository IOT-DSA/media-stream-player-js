import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { Player } from './Player'
import debug from 'debug'
const debugLog = debug('msp:media-stream-player');

interface InitialAttributes {
  readonly hostname: string
  readonly resolution: string
  readonly autoplay: boolean
  readonly username: string
  readonly password: string
}

type SetStateType = React.Dispatch<React.SetStateAction<InitialAttributes>>

/**
 * Create a custom element that uses React to mount the actual Player component.
 *
 * Note that this does not use a shadow DOM to avoid certain issues with React.
 */
export class MediaStreamPlayer extends HTMLElement {
  private _setState?: SetStateType;
  private username: string;
  private password: string;

  public attributeChangeSubscriber(cb: SetStateType) {
    this._setState = cb
    debugLog('State set.');
  }

  constructor() {
    super()
    this.username = '';
    this.password = '';
  }

  static get observedAttributes() {
    return ['hostname', 'autoplay', 'resolution']
  }

  get hostname() {
    return this.getAttribute('hostname') ?? ''
  }

  set hostname(value: string) {
    if (!value) {
      this.setAttribute('hostname', value);
      return;
    }

    this.setAttribute('hostname', value)
  }

  get autoplay() {
    return this.hasAttribute('autoplay')
  }

  set autoplay(value) {
    if (value !== undefined) {
      this.setAttribute('autoplay', '')
    } else {
      this.removeAttribute('autoplay')
    }
  }

  get resolution() {
    return this.getAttribute('resolution') ?? '640x360'
  }

  set resolution(value: string) {
    if (!value) {
      this.setAttribute('resolution', '640x360')
    } else {
      this.setAttribute('resolution', value)
    }
  }

  connectedCallback() {
    const { hostname, autoplay, resolution, username, password } = this

    ReactDOM.render(
      <PlayerComponent
        subscribeAttributesChanged={(cb) =>
          this.attributeChangeSubscriber(cb)
        }
        initialAttributes={{
          hostname,
          autoplay,
          resolution,
          username,
          password,
        }}
      />,
      this,
    )
  }

  disconnectedCallback() {
    ReactDOM.unmountComponentAtNode(this)
  }

  attributeChangedCallback(attrName: string, _: string, value: string) {
    if (this._setState === undefined) {
      console.warn(`ignored attribute change: ${attrName}=${value}`)
      return
    }

    let { hostname, autoplay, resolution, username, password } = this;
    if (attrName === 'hostname' && value != hostname) {
      hostname = value;
    }
    debugLog(`MediaStreamPlayer attributeChangedCallback: Host: "${hostname}", autoPlay "${autoplay}", resolution: "${resolution}", username "${username}", password "${password}"`);
    this._setState({
      hostname,
      autoplay,
      resolution,
      username,
      password,
    })
  }
}

interface PlayerComponentProps {
  readonly initialAttributes: InitialAttributes
  readonly subscribeAttributesChanged: (cb: SetStateType) => void
}

const PlayerComponent: React.FC<PlayerComponentProps> = ({
  subscribeAttributesChanged,
  initialAttributes,
}) => {
  const [state, setState] = useState(initialAttributes)

  useEffect(() => {
    subscribeAttributesChanged(setState)
  }, [subscribeAttributesChanged])

  let { hostname, autoplay, resolution, username, password } = state;

  if (hostname) {
    let i = hostname.indexOf('@')
    if (i != -1) {
        let creds = hostname.substring(0, i);
        let j = creds.indexOf(':');
        username = creds.substring(0, j);
        password = creds.substring(j + 1);
        hostname = hostname.substring(i+1);
    }
  }
  debugLog(`PlayerComponentProps: "${hostname}", autoPlay "${autoplay}", resolution: "${resolution}", username "${username}", password "${password}"`);
  const fmt = "H264";
  const params = {'resolution': resolution, 'videocodec': 'h264', 'username': username, 'password': password};

  return <Player hostname={hostname} autoPlay={autoplay} format={fmt} vapixParams={params}/>
}
