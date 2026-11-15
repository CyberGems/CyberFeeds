import { lookup } from 'node:dns'
import { BlockList, isIP, type LookupFunction } from 'node:net'

const nonPublic = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 3]
] as const) nonPublic.addSubnet(address, prefix)
nonPublic.addSubnet('2001::', 23, 'ipv6')
nonPublic.addSubnet('2001:db8::', 32, 'ipv6')
nonPublic.addSubnet('2002::', 16, 'ipv6')

const globalIPv6 = new BlockList()
globalIPv6.addSubnet('2000::', 3, 'ipv6')

export function isPublicThumbnailPage(page: URL): boolean {
  const host = page.hostname.replace(/\.$/, '')
  return ['http:', 'https:'].includes(page.protocol) && !page.username && !page.password &&
    !page.port && host.includes('.') && !isIP(host) && !host.endsWith('.localhost')
}

// Hand the vetted addresses directly to the socket's DNS lookup callback.
export const lookupThumbnailHost: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '')
    const publicAddresses = addresses.filter(({ address, family }) =>
      family === 4 ? !nonPublic.check(address) :
        family === 6 && globalIPv6.check(address, 'ipv6') && !nonPublic.check(address, 'ipv6')
    )
    if (!publicAddresses.length) return callback(new Error('Thumbnail host has no public address'), '')
    if (options.all) return callback(null, publicAddresses)
    const { address, family } = publicAddresses[0]
    return callback(null, address, family)
  })
}
