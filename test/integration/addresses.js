/* global describe, it */

let assert = require('assert')
let bitcoin = require('../../')
let dhttp = require('dhttp/200')

let LITECOIN = {
  messagePrefix: '\x19Litecoin Signed Message:\n',
  bip32: {
    public: 0x019da462,
    private: 0x019d9cfe
  },
  pubKeyHash: 0x30,
  scriptHash: 0x32,
  wif: 0xb0
}

// deterministic RNG for testing only
function rng () { return Buffer.from('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz') }

// TODO: remove
let baddress = bitcoin.address
let bcrypto = bitcoin.crypto
function getAddress (node, network) {
  network = network || bitcoin.networks.bitcoin
  return baddress.toBase58Check(bcrypto.hash160(node.publicKey), network.pubKeyHash)
}

describe('bitcoinjs-lib (addresses)', function () {
  it('can generate a random address', function () {
    var keyPair = bitcoin.ECPair.makeRandom({ rng: rng })
    var address = getAddress(keyPair)

    assert.strictEqual(address, '1F5VhMHukdnUES9kfXqzPzMeF1GPHKiF64')
  })

  it('can generate an address from a SHA256 hash', function () {
    var hash = bitcoin.crypto.sha256(Buffer.from('correct horse battery staple'))

    var keyPair = bitcoin.ECPair.fromPrivateKey(hash)
    var address = getAddress(keyPair)

    // Generating addresses from SHA256 hashes is not secure if the input to the hash function is predictable
    // Do not use with predictable inputs
    assert.strictEqual(address, '1C7zdTfnkzmr13HfA2vNm5SJYRK6nEKyq8')
  })

  it('can import an address via WIF', function () {
    var keyPair = bitcoin.ECPair.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')
    var address = getAddress(keyPair)

    assert.strictEqual(address, '19AAjaTUbRjQCMuVczepkoPswiZRhjtg31')
  })

  it('can generate a 2-of-3 multisig P2SH address', function () {
    var pubKeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9',
      '03c6103b3b83e4a24a0e33a4df246ef11772f9992663db0c35759a5e2ebf68d8e9'
    ].map(function (hex) { return Buffer.from(hex, 'hex') })

    var redeemScript = bitcoin.script.multisig.output.encode(2, pubKeys) // 2 of 3
    var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey)

    assert.strictEqual(address, '36NUkt6FWUi3LAWBqWRdDmdTWbt91Yvfu7')
  })

  it('can generate a SegWit address', function () {
    var keyPair = bitcoin.ECPair.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')

    var scriptPubKey = bitcoin.script.witnessPubKeyHash.output.encode(bitcoin.crypto.hash160(keyPair.publicKey))
    var address = bitcoin.address.fromOutputScript(scriptPubKey)

    assert.strictEqual(address, 'bc1qt97wqg464zrhnx23upykca5annqvwkwujjglky')
  })

  it('can generate a SegWit address (via P2SH)', function () {
    var keyPair = bitcoin.ECPair.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')

    var redeemScript = bitcoin.script.witnessPubKeyHash.output.encode(bitcoin.crypto.hash160(keyPair.publicKey))
    var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey)

    assert.strictEqual(address, '34AgLJhwXrvmkZS1o5TrcdeevMt22Nar53')
  })

  it('can generate a SegWit 3-of-4 multisig address', function () {
    var pubKeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9',
      '023e4740d0ba639e28963f3476157b7cf2fb7c6fdf4254f97099cf8670b505ea59',
      '03c6103b3b83e4a24a0e33a4df246ef11772f9992663db0c35759a5e2ebf68d8e9'
    ].map(function (hex) { return Buffer.from(hex, 'hex') })

    var witnessScript = bitcoin.script.multisig.output.encode(3, pubKeys) // 3 of 4
    var scriptPubKey = bitcoin.script.witnessScriptHash.output.encode(bitcoin.crypto.sha256(witnessScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey)

    assert.strictEqual(address, 'bc1q75f6dv4q8ug7zhujrsp5t0hzf33lllnr3fe7e2pra3v24mzl8rrqtp3qul')
  })

  it('can generate a SegWit 2-of-2 multisig address (via P2SH)', function () {
    var pubKeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9'
    ].map(function (hex) { return Buffer.from(hex, 'hex') })

    var witnessScript = bitcoin.script.multisig.output.encode(2, pubKeys) // 2 of 2
    var redeemScript = bitcoin.script.witnessScriptHash.output.encode(bitcoin.crypto.sha256(witnessScript))
    var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey)

    assert.strictEqual(address, '3P4mrxQfmExfhxqjLnR2Ah4WES5EB1KBrN')
  })

  it('can support the retrieval of transactions for an address (via 3PBP)', function (done) {
    var keyPair = bitcoin.ECPair.makeRandom()
    var address = getAddress(keyPair)

    dhttp({
      method: 'POST',
      url: 'https://api.ei8ht.com.au/3/addrtxs',
      body: {
        addrs: [address],
        height: 0
      }
    }, function (err, transactions) {
      if (err) return done(err)

      // random private keys [probably] have no transactions
      assert.strictEqual(Object.keys(transactions).length, 0)
      done()
    })
  })

  // other networks
  it('can generate a Testnet address', function () {
    let testnet = bitcoin.networks.testnet
    let keyPair = bitcoin.ECPair.makeRandom({ network: testnet, rng: rng })
    let wif = keyPair.toWIF()
    let address = getAddress(keyPair, testnet)

    assert.strictEqual(address, 'mubSzQNtZfDj1YdNP6pNDuZy6zs6GDn61L')
    assert.strictEqual(wif, 'cRgnQe9MUu1JznntrLaoQpB476M8PURvXVQB5R2eqms5tXnzNsrr')
  })

  it('can generate a Litecoin address', function () {
    let keyPair = bitcoin.ECPair.makeRandom({ network: LITECOIN, rng: rng })
    let wif = keyPair.toWIF()
    let address = getAddress(keyPair, LITECOIN)

    assert.strictEqual(address, 'LZJSxZbjqJ2XVEquqfqHg1RQTDdfST5PTn')
    assert.strictEqual(wif, 'T7A4PUSgTDHecBxW1ZiYFrDNRih2o7M8Gf9xpoCgudPF9gDiNvuS')
  })
})
