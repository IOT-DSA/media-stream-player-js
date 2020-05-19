import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { Player } from './Player'

interface InitialAttributes {
  readonly hostname: string
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
    console.log('State set.');
  }

  constructor() {
    super()
    this.username = '';
    this.password = '';
  }

  static get observedAttributes() {
    return ['hostname', 'autoplay']
  }

  get hostname() {
    return this.getAttribute('hostname') ?? ''
  }

  set hostname(value: string) {
    let i = value.indexOf('@')
    if (i != -1) {
      let creds = value.substring(0, i);
      let j = creds.indexOf(':');
      this.username = creds.substring(0, j);
      this.password = creds.substring(j + 1);
      value = value.substring(i+1);
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

  connectedCallback() {
    let i = this.hostname.indexOf('@')
      if (i != -1) {
        let creds = this.hostname.substring(0, i);
        let j = creds.indexOf(':');
        this.username = creds.substring(0, j);
        this.password = creds.substring(j + 1);
        this.hostname = this.hostname.substring(i+1);
      }

      let hd = new Headers({});
      if (this.username) {
        hd.append('Authorization', `Basic ${btoa(`${this.username}:${this.password}`)}`);
      }

    // window.fetch(`http://${this.hostname}/axis-cgi/usergroup.cgi`, {
    //     credentials: 'include',
    //     headers: hd,
    //     mode: 'no-cors',})
    //   .then(() => {
        const { hostname, autoplay, username, password } = this

        ReactDOM.render(
          <PlayerComponent
            subscribeAttributesChanged={(cb) =>
              this.attributeChangeSubscriber(cb)
            }
            initialAttributes={{
              hostname,
              autoplay,
              username,
              password,
            }}
          />,
          this,
        )
      // })
      // .catch((err) => {
      //   console.error(`Authorization failed: ${err.message}`)
      // })
  }

  disconnectedCallback() {
    ReactDOM.unmountComponentAtNode(this)
  }

  attributeChangedCallback(attrName: string, _: string, value: string) {
    if (this._setState === undefined) {
      console.warn(`ignored attribute change: ${attrName}=${value}`)
      return
    }

    const { hostname, autoplay, username, password } = this
    this._setState({
      hostname,
      autoplay,
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

  const { hostname, autoplay, username, password } = state;
  const fmt = "H264";
  const params = {'resolution': '640x360', 'videocodec': 'h264', 'username': username, 'password': password};

  return <Player hostname={hostname} autoPlay={autoplay} format={fmt} vapixParams={params}/>
}
