import proto from '@helium/proto'
import { PaymentV2, Transaction } from '..'
import {
  usersFixture,
  bobB58,
  aliceB58,
} from '../../../../integration_tests/fixtures/users'

Transaction.config({
  txnFeeMultiplier: 5000,
  dcPayloadSize: 24,
  stakingFeeTxnAddGatewayV1: 40 * 100000,
  stakingFeeTxnAssertLocationV1: 10 * 100000,
})

const paymentFixture = async () => {
  const { bob, alice } = await usersFixture()

  return new PaymentV2({
    payer: bob.address,
    payments: [
      {
        payee: alice.address,
        amount: 10,
        memo: 'bW9ja21lbW8=',
        tokenType: 'hnt',
      },
    ],
    nonce: 1,
  })
}

test('create a PaymentV2', async () => {
  const payment = await paymentFixture()

  expect(payment.payer?.b58).toBe(bobB58)
  expect(payment.payments?.length).toBe(1)
  expect((payment.payments || [])[0].payee.b58).toBe(aliceB58)
  expect((payment.payments || [])[0].amount).toBe(10)
  expect((payment.payments || [])[0].memo).toBe('bW9ja21lbW8=')
  expect((payment.payments || [])[0].tokenType).toBe('hnt')
  expect(payment.nonce).toBe(1)
  expect(payment.fee).toBe(35000)
  expect(payment.type).toBe('payment_v2')
})

describe('serialize and deserialize', () => {
  it('serializes a PaymentV2 txn', async () => {
    const payment = await paymentFixture()
    expect(payment.serialize().length).toBeGreaterThan(0)
  })

  it('serializes to base64 string', async () => {
    const payment = await paymentFixture()
    const paymentString = payment.toString()
    // verify that we can decode it back from its serialized string
    const buf = Buffer.from(paymentString, 'base64')
    const decoded = proto.helium.blockchain_txn.decode(buf)
    expect(decoded.paymentV2?.nonce?.toString()).toBe('1')
  })

  it('deserializes from a base64 string', async () => {
    const payment = await paymentFixture()
    const paymentString = payment.toString()
    const deserialized = PaymentV2.fromString(paymentString)
    expect(deserialized.payer?.b58).toBe(payment.payer?.b58)
    expect(deserialized.nonce).toBe(payment.nonce)
    expect(deserialized.payments[0]?.amount).toBe(payment.payments[0]?.amount)
    expect(deserialized.payments[0]?.payee.b58).toBe(
      payment.payments[0]?.payee.b58,
    )
    expect(deserialized.payments[0]?.memo).toBe(payment.payments[0]?.memo)
    expect(deserialized.payments[0]?.tokenType).toBe(payment.payments[0]?.tokenType)
    expect(deserialized.fee).toBe(payment.fee)
  })
})

describe('sign', () => {
  it('adds the payer signature', async () => {
    const { bob, alice } = await usersFixture()
    const payment = new PaymentV2({
      payer: bob.address,
      payments: [
        {
          payee: alice.address,
          amount: 10,
        },
      ],
      nonce: 1,
    })

    const signedPayment = await payment.sign({ payer: bob })

    if (!signedPayment.signature) throw new Error('null')

    expect(Buffer.byteLength(Buffer.from(signedPayment.signature))).toBe(64)
  })

  it('preserves the signature when deserializing', async () => {
    const { bob, alice } = await usersFixture()
    const payment = new PaymentV2({
      payer: bob.address,
      payments: [
        {
          payee: alice.address,
          amount: 10,
        },
      ],
      nonce: 1,
    })

    const signedPayment = await payment.sign({ payer: bob })
    const serializedPayment = signedPayment.toString()
    const deserializedPayment = PaymentV2.fromString(serializedPayment)
    expect(deserializedPayment.signature).toEqual(signedPayment.signature)
  })

  it('should sign the correct signature while handling an empty memo', async () => {
    const payment = await paymentFixture()
    payment.payments[0].memo = 'AAAAAAAAAAA='
    const reserializedTxn = PaymentV2.fromString(payment.toString())
    const { bob } = await usersFixture()
    const signedPayment = await reserializedTxn.sign({ payer: bob })
    const decoded = proto.helium.blockchain_txn.decode(Buffer.from(signedPayment.toString(), 'base64'))
    const base64Signature = (decoded.paymentV2?.signature as Buffer).toString('base64')
    expect(base64Signature).toEqual('PiDvVpuSI0PViJi/ItQnqyMPbHFh3mmZSMpBzHuJ6TXlig1hDtdUE8is9FJBbhdJbSz9jCpHHBB2O2d0pYPSCw==')
  })
})
