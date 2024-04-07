import type { Actions, PageServerLoad } from './$types';
import { eq, sql } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { db, posts } from '$lib/server/db';
import slugify from 'slugify';
import { readingTime } from 'reading-time-estimator';
import type { RequestEvent } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }: RequestEvent) => {
	const post = (await db.select().from(posts).where(eq(posts.slug, params.slug)))[0];
	if (!post) {
		error(404);
	}
	return {
		post
	};
};

export const actions = {
	default: async ({ params, request }) => {
		const formData = await request.formData();
		const title = formData.get('title')?.toString().trim() ?? '';
		const content = formData.get('content')?.toString().trim() ?? '';

		// If no changes have been made then simply redirect
		const post = (await db.select().from(posts).where(eq(posts.slug, params.slug)))[0];

		if (post?.title === title && post?.content === content) {
			redirect(303, '/posts/' + post?.slug);
		}

		if (title.length < 12)
			return fail(422, {
				title,
				content,
				error: 'Title should be longer than 12 characters.'
			});

		if (title.length > 64)
			return fail(422, {
				title,
				content,
				error: 'Title should be shorter than 64 characters.'
			});

		if (content.length < 1000)
			return fail(422, {
				title,
				content,
				error: 'Content should have more than 100 characters.'
			});

		// Create a slug for the title
		const newSlug = slugify(title, {
			lower: true,
			strict: true
		});

		// Check for existing posts with same slugs
		if (params.slug !== newSlug) {
			const [{ exists }] = await db.execute(
				sql`select exists(select 1 from ${posts} where ${posts.slug} = ${newSlug})`
			);
			if (exists)
				return fail(409, {
					title,
					content,
					error: 'A post with a similar title already exits.'
				});
		}

		// calculate read time of the post
		const readTime = readingTime(content, 230).minutes;
		const oldSlug = params.slug;
		const lastEdit = sql`CURRENT_TIMESTAMP`;
		try {
			await db
				.update(posts)
				.set({
					slug: newSlug,
					title,
					content,
					readTime,
					lastEdit
				})
				.where(eq(posts.slug, oldSlug));
		} catch (error) {
			return fail(401, { title, content, error: error.message });
		}
		redirect(303, '/posts/' + newSlug);
	}
} satisfies Actions;
