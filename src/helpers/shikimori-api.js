function shikimoriAPI(path, options = {}) {

  return new Promise((resolve, reject) => {
    const url = 'https://shikimori.org/api' + path
    let headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Play Shikimori; Browser extension; https://github.com/cawa-93/play-shikimori"
    });

    options.headers = headers

    chrome.runtime.sendMessage({
      contentScriptQuery: 'fetchUrl',
      url,
      options,
    },
      ({ response, error }) => {
        if (error) {
          return reject(error)
        }

        resolve(response)
      })


  })
}

export { shikimoriAPI }
export default shikimoriAPI