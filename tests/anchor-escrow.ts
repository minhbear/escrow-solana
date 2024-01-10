import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AnchorEscrow } from "../target/types/anchor_escrow";
import {
	Keypair,
	LAMPORTS_PER_SOL,
	PublicKey,
	SystemProgram,
	Transaction,
  Commitment
} from '@solana/web3.js';
import {
	MINT_SIZE,
	TOKEN_PROGRAM_ID,
	createAssociatedTokenAccountIdempotentInstruction,
	createInitializeMint2Instruction,
	createMintToInstruction,
	getAssociatedTokenAddressSync,
	getMinimumBalanceForRentExemptMint,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { randomBytes } from 'crypto';

const commitment: Commitment = 'confirmed';

describe("anchor-escrow", () => {
	// Configure the client to use the local cluster.
	anchor.setProvider(anchor.AnchorProvider.env());

	const provider = anchor.getProvider();

	const connection = provider.connection;

	const program = anchor.workspace.AnchorEscrow as Program<AnchorEscrow>;

	const confirm = async (signature: string): Promise<string> => {
		const block = await connection.getLatestBlockhash();
		await connection.confirmTransaction({
			signature,
			...block,
		});
		return signature;
	};

	const log = async (signature: string): Promise<string> => {
		console.log(
			`Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${connection.rpcEndpoint}`
		);
		return signature;
	};

	const seed = new BN(randomBytes(8));

	const [maker, taker, mintA, mintB] = Array.from({ length: 4 }, () =>
		Keypair.generate()
	);

	const [makerAtaA, makerAtaB, takerAtaA, takerAtaB] = [maker, taker]
		.map((a) =>
			[mintA, mintB].map((m) =>
				getAssociatedTokenAddressSync(m.publicKey, a.publicKey)
			)
		)
		.flat();

	const escrow = PublicKey.findProgramAddressSync(
		[Buffer.from('escrow'), maker.publicKey.toBuffer(), seed.toBuffer('le', 8)],
		program.programId
	)[0];
	const vault = getAssociatedTokenAddressSync(mintA.publicKey, escrow, true);

	it('Airdrop', async () => {
		await Promise.all([
			await connection
				.requestAirdrop(maker.publicKey, LAMPORTS_PER_SOL * 10)
				.then(confirm),
			await connection
				.requestAirdrop(taker.publicKey, LAMPORTS_PER_SOL * 10)
				.then(confirm),
		]);
	});

	it('Create mints', async () => {
		let lamports = await getMinimumBalanceForRentExemptMint(connection);
		let tx = new Transaction();
		tx.instructions = [
			SystemProgram.createAccount({
				fromPubkey: provider.publicKey,
				newAccountPubkey: mintA.publicKey,
				lamports,
				space: MINT_SIZE,
				programId: TOKEN_PROGRAM_ID,
			}),
			SystemProgram.createAccount({
				fromPubkey: provider.publicKey,
				newAccountPubkey: mintB.publicKey,
				lamports,
				space: MINT_SIZE,
				programId: TOKEN_PROGRAM_ID,
			}),
			createInitializeMint2Instruction(
				mintA.publicKey,
				6,
				maker.publicKey,
				null
			),
			createInitializeMint2Instruction(
				mintB.publicKey,
				6,
				taker.publicKey,
				null
			),
			createAssociatedTokenAccountIdempotentInstruction(
				provider.publicKey,
				makerAtaA,
				maker.publicKey,
				mintA.publicKey
			),
			createAssociatedTokenAccountIdempotentInstruction(
				provider.publicKey,
				takerAtaB,
				taker.publicKey,
				mintB.publicKey
			),
			createMintToInstruction(mintA.publicKey, makerAtaA, maker.publicKey, 1e9),
			createMintToInstruction(mintB.publicKey, takerAtaB, taker.publicKey, 1e9),
		];

		await provider.sendAndConfirm(tx, [mintA, mintB, maker, taker]).then(log);
	});

	it('Make', async () => {
		await program.methods
			.make(seed, new BN(1e6), new BN(1e6))
			.accounts({
				maker: maker.publicKey,
				mintA: mintA.publicKey,
				mintB: mintB.publicKey,
				makerAtaA,
				escrow,
				vault,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
			})
			.signers([maker])
			.rpc()
			.then(confirm)
			.then(log);
	});

	xit('Refund', async () => {
		await program.methods
			.refund()
			.accounts({
				maker: maker.publicKey,
				mintA: mintA.publicKey,
				makerAtaA,
				escrow,
				vault,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
			})
			.signers([maker])
			.rpc()
			.then(confirm)
			.then(log);
	});

	 it('Take', async () => {
    await program.methods
			.take()
			.accounts({
				maker: maker.publicKey,
				taker: taker.publicKey,
				mintA: mintA.publicKey,
				mintB: mintB.publicKey,
				makerAtaB,
				takerAtaA,
				takerAtaB,
				escrow,
				vault,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
			})
			.signers([taker])
			.rpc()
			.then(confirm)
			.then(log);
  });
});

// anchor-escrow:
// Your transaction signature: https://explorer.solana.com/transaction/F8p2L9DzaxxhNokXS8uy3CMzPcnCuNHUPSDu7cVdBEGLFZJQPLfPsNW8fPFYjUpXs3rdt5DRmuVSLc9BtNL4oTX?cluster=custom&customUrl=http://localhost:8899
// Your transaction signature: https://explorer.solana.com/transaction/4cKHDdqQQ4pNKwVApaz2as982XYHMQQi9AgJxyMhVRpsPk2N9NyEH8bMm9AVdQcjNWkc5GoW5U84srvzHim4q5zd?cluster=custom&customUrl=http://localhost:8899
// - Refund
// Your transaction signature: https://explorer.solana.com/transaction/4KPuV65AXY1PTJN8oT3Gu9rLDp6oooDcWgfYPu1F1a5ASWg5PDkTXjttFDPoXVSSAUmkdsiWXi3n5giAKL39YMgF?cluster=custom&customUrl=http://localhost:8899